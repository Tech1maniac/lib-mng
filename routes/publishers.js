const express = require('express');
const { oracledb } = require('../config/db');
const router = express.Router();

// GET all publishers
router.get('/', async (req, res) => {
  let conn;
  try {
    conn = await oracledb.getConnection();
    const result = await conn.execute(
      `SELECT publisher_id, name FROM publishers ORDER BY name`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/publishers error:', err);
    res.status(500).json({ message: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

// POST a new publisher
router.post('/', async (req, res) => {
  const { name, address, contact } = req.body;
  let conn;
  try {
    conn = await oracledb.getConnection();
    await conn.execute(
      `INSERT INTO publishers(name, address, contact)
       VALUES (:name, :address, :contact)`,
      { name, address, contact },
      { autoCommit: true }
    );
    res.status(201).json({ message: 'Publisher added' });
  } catch (err) {
    console.error('POST /api/publishers error:', err);
    res.status(400).json({ message: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

module.exports = router;
