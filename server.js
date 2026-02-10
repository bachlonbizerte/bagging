const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());
app.use(express.json());

// === CONFIG DB AVEC VARIABLES D'ENV ===
const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
};

async function getConnection() {
  return await mysql.createConnection(dbConfig);
}

// Test
app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'Badge API en ligne' });
});

/**
 * POST /api/users
 * Créer un utilisateur + badge
 * - Reçoit : badge_id, name (nom complet), prenom, nom, email, role, departement, numero, ville, societe
 * - Pour compatibilité avec l’ancienne version, name reste obligatoire
 */
app.post('/api/users', async (req, res) => {
  const {
    badge_id,
    name,       // nom complet (prenom + ' ' + nom)
    prenom,
    nom,
    email,
    role,
    departement,
    numero,
    ville,
    societe,
  } = req.body;

  if (!badge_id || !name) {
    return res
      .status(400)
      .json({ message: 'badge_id et name sont obligatoires' });
  }

  try {
    const conn = await getConnection();
    await conn.execute(
      `INSERT INTO users
        (badge_id, name, prenom, nom, email, role, departement, numero, ville, societe)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        badge_id,
        name,
        prenom || null,
        nom || null,
        email || null,
        role || null,
        departement || null,
        numero || null,
        ville || null,
        societe || null,
      ]
    );
    await conn.end();
    res.status(201).json({ message: 'User créé' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

/**
 * GET /api/users
 * Liste des inscriptions
 */
app.get('/api/users', async (req, res) => {
  try {
    const conn = await getConnection();
    const [rows] = await conn.execute(
      `SELECT id,
              badge_id,
              name,
              prenom,
              nom,
              email,
              role,
              departement,
              numero,
              ville,
              societe,
              created_at
       FROM users
       ORDER BY id DESC`
    );
    await conn.end();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

/**
 * DELETE /api/users/:badgeId
 * Supprimer UNE inscription par badge_id
 */
app.delete('/api/users/:badgeId', async (req, res) => {
  const badgeId = req.params.badgeId;

  try {
    const conn = await getConnection();
    const [result] = await conn.execute(
      'DELETE FROM users WHERE badge_id = ?',
      [badgeId]
    );
    await conn.end();

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }

    res.json({ message: 'Inscription supprimée', badge_id: badgeId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

/**
 * DELETE /api/users
 * Effacer TOUTES les inscriptions
 */
app.delete('/api/users', async (req, res) => {
  try {
    const conn = await getConnection();
    await conn.execute('DELETE FROM users');
    await conn.end();
    res.json({ message: 'Toutes les inscriptions ont été supprimées' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

/**
 * POST /api/movements
 * Enregistrer IN/OUT
 * - alterne IN / OUT pour un même badge
 */
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

/**
 * GET /api/movements
 * Historique des mouvements
 */
app.get('/api/movements', async (req, res) => {
  try {
    const conn = await getConnection();
    const [rows] = await conn.execute(
      `SELECT m.id,
              m.badge_id,
              m.type,
              m.created_at,
              u.name
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

/**
 * DELETE /api/movements
 * Effacer TOUT l’historique des entrées/sorties
 */
app.delete('/api/movements', async (req, res) => {
  try {
    const conn = await getConnection();
    await conn.execute('DELETE FROM movements');
    await conn.end();
    res.json({ message: 'Tout l’historique des mouvements a été supprimé' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('API running on port ' + PORT);
});
