// routes/books.js
const express = require("express");
const { oracledb } = require("../config/db");
const router = express.Router();

// GET all books or search by title (partial, case-insensitive, top 5)
router.get("/", async (req, res) => {
  let conn;
  try {
    conn = await oracledb.getConnection();

    const { q } = req.query;
    let sql, binds;

    if (q) {
      // Search mode: partial match on title, return first 5
      sql = `
        SELECT book_id,
               title,
               isbn,
               year_published,
               publisher_id
          FROM books
         WHERE LOWER(title) LIKE :search
         ORDER BY title
         FETCH FIRST 5 ROWS ONLY
      `;
      binds = { search: `%${q.toLowerCase()}%` };
    } else {
      // No query: return all books
      sql = `
        SELECT book_id,
               title,
               isbn,
               year_published,
               publisher_id
          FROM books
         ORDER BY book_id
      `;
      binds = {};
    }

    const result = await conn.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });

    res.json(result.rows);
  } catch (err) {
    console.error("GET /api/books error:", err);
    res.status(500).json({ message: err.message });
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (_) {}
    }
  }
});

// POST a new book
router.post("/", async (req, res) => {
  const { title, isbn, year_published, publisher_id } = req.body;
  let conn;
  try {
    conn = await oracledb.getConnection();
    await conn.execute(
      `INSERT INTO books(title, isbn, year_published, publisher_id)
       VALUES (:title, :isbn, :year_published, :publisher_id)`,
      {
        title,
        isbn,
        year_published: Number(year_published),
        publisher_id: Number(publisher_id),
      },
      { autoCommit: true }
    );
    res.status(201).json({ message: "Book added" });
  } catch (err) {
    console.error("POST /api/books error:", err);
    res.status(400).json({ message: err.message });
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (_) {}
    }
  }
});

router.delete("/:id", async (req, res) => {
  let conn;
  const { id } = req.params;

  try {
    conn = await oracledb.getConnection();
    const result = await conn.execute(
      `DELETE FROM books WHERE book_id = :id`,
      { id: Number(id) },
      { autoCommit: true }
    );

    if (result.rowsAffected === 0) {
      return res.status(404).json({ message: "Book not found" });
    }

    return res.json({ message: "Book deleted" });
  } catch (err) {
    console.error("DELETE /api/books/:id error:", err);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (_) {}
    }
  }
});

module.exports = router;
