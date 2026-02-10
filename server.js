const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());
app.use(express.json());

// === CONFIG DB AVEC VARIABLES D'ENV (Render + Railway) ===
const dbConfig = {
  host: process.env.DB_HOST,               // ex: mainline.proxy.rlwy.net
  port: process.env.DB_PORT || 3306,       // ex: 16259 (sinon 3306 par défaut)
  user: process.env.DB_USER,               // ex: root
  password: process.env.DB_PASS,           // mot de passe Railway
  database: process.env.DB_NAME,           // ex: railway
};

async function getConnection() {
  return await mysql.createConnection(dbConfig);
}

// Simple route test
app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'Badge API en ligne' });
});

// POST /api/users -> créer un utilisateur + badge
app.post('/api/users', async (req, res) => {
  const { badge_id, name, email, role } = req.body;
  if (!badge_id || !name) {
    return res.status(400).json({ message: 'badge_id et name sont obligatoires' });
  }
  try {
    const conn = await getConnection();
    await conn.execute(
      'INSERT INTO users (badge_id, name, email, role) VALUES (?,?,?,?)',
      [badge_id, name, email || null, role || null]
    );
    await conn.end();
    res.status(201).json({ message: 'User créé' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET /api/users -> liste des inscriptions
app.get('/api/users', async (req, res) => {
  try {
    const conn = await getConnection();
    const [rows] = await conn.execute(
      'SELECT badge_id, name, email, role, created_at FROM users ORDER BY id DESC'
    );
    await conn.end();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/movements -> enregistrer IN/OUT
app.post('/api/movements', async (req, res) => {
  const { badge_id } = req.body;
  if (!badge_id) {
    return res.status(400).json({ message: 'badge_id obligatoire' });
  }

  try {
    const conn = await getConnection();

    const [rows] = await conn.execute(
      'SELECT type FROM movements WHERE badge_id = ? ORDER BY id DESC LIMIT 1',
      [badge_id]
    );

    let nextType = 'IN';
    if (rows.length && rows[0].type === 'IN') {
      nextType = 'OUT';
    }

    await conn.execute(
      'INSERT INTO movements (badge_id, type) VALUES (?, ?)',
      [badge_id, nextType]
    );

    const [userRows] = await conn.execute(
      'SELECT name FROM users WHERE badge_id = ? LIMIT 1',
      [badge_id]
    );
    const name = userRows.length ? userRows[0].name : null;

    await conn.end();

    res.json({
      badge_id,
      type: nextType,
      name,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET /api/movements -> historique
app.get('/api/movements', async (req, res) => {
  try {
    const conn = await getConnection();
    const [rows] = await conn.execute(
      `SELECT m.id, m.badge_id, m.type, m.created_at, u.name
       FROM movements m
       LEFT JOIN users u ON u.badge_id = m.badge_id
       ORDER BY m.id DESC`
    );
    await conn.end();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('API running on port ' + 
