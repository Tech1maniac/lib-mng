const express = require('express');
const { oracledb } = require('../config/db');
const router = express.Router();

// GET all books
router.get('/', async (req, res) => {
  let conn;
  try {
    conn = await oracledb.getConnection();
    const result = await conn.execute(
      `SELECT book_id, title, isbn, year_published, publisher_id FROM books ORDER BY book_id`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/books error:', err);
    res.status(500).json({ message: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

// POST a new book
router.post('/', async (req, res) => {
  const { title, isbn, year_published, publisher_id } = req.body;
  let conn;
  try {
    conn = await oracledb.getConnection();
    await conn.execute(
      `INSERT INTO books(title, isbn, year_published, publisher_id)
       VALUES (:title, :isbn, :year_published, :publisher_id)`,
      { title, isbn, year_published: Number(year_published), publisher_id: Number(publisher_id) },
      { autoCommit: true }
    );
    res.status(201).json({ message: 'Book added' });
  } catch (err) {
    console.error('POST /api/books error:', err);
    res.status(400).json({ message: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

module.exports = router;
