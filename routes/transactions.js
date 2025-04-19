// routes/transactions.js
const router = require('express').Router();
const db     = require('../config/db');

router.get('/recent', (req, res, next) => {
  const sql = `
    SELECT m.name   AS member,
           b.title  AS book,
           t.date,
           t.status
    FROM transactions t
    JOIN members     m ON t.member_id = m.id
    JOIN books       b ON t.book_id   = b.id
    ORDER BY t.date DESC
    LIMIT 5
  `;
  db.query(sql, (err, results) => {
    if (err) return next(err);
    res.json(results);
  });
});

module.exports = router;
