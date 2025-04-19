// routes/stats.js
const router = require('express').Router();
const db     = require('../config/db');

router.get('/', (req, res, next) => {
  const stats = {};
  db.query('SELECT COUNT(*) AS total FROM books', (err, result) => {
    if (err) return next(err);
    stats.totalBooks = result[0].total;

    db.query('SELECT COUNT(*) AS total FROM members', (err, result) => {
      if (err) return next(err);
      stats.totalMembers = result[0].total;

      db.query(
        `SELECT COUNT(*) AS total 
         FROM transactions 
         WHERE DATE(date) = CURDATE()`,
        (err, result) => {
          if (err) return next(err);
          stats.issuedToday = result[0].total;
          res.json(stats);
        }
      );
    });
  });
});

module.exports = router;
