const express = require('express');
const { oracledb } = require('../config/db');
const router = express.Router();

// GET /api/loans - Fetch all loans
router.get('/', async (req, res) => {
  let conn;
  try {
    conn = await oracledb.getConnection();
    const result = await conn.execute(
      `SELECT
         loan_id,
         member_id,
         book_id,
         TO_CHAR(loan_date, 'YYYY-MM-DD')   AS loan_date,
         TO_CHAR(due_date,  'YYYY-MM-DD')   AS due_date,
         TO_CHAR(return_date, 'YYYY-MM-DD') AS return_date,
         fine
       FROM loans
       ORDER BY loan_id`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/loans error:', err);
    res.status(500).json({ message: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

// POST /api/loans - Add a new loan
router.post('/', async (req, res) => {
  const {
    member_id,
    book_id,
    loan_date,
    due_date,
    return_date = null,
    fine = 0
  } = req.body;
  let conn;

  try {
    conn = await oracledb.getConnection();
    await conn.execute(
      `INSERT INTO loans (
         member_id,
         book_id,
         loan_date,
         due_date,
         return_date,
         fine
       ) VALUES (
         :member_id,
         :book_id,
         TO_DATE(:loan_date, 'YYYY-MM-DD'),
         TO_DATE(:due_date,  'YYYY-MM-DD'),
         TO_DATE(:return_date, 'YYYY-MM-DD'),
         :fine
       )`,
      {
        member_id: Number(member_id),
        book_id:   Number(book_id),
        loan_date,
        due_date,
        return_date,
        fine:      Number(fine)
      },
      { autoCommit: true }
    );
    res.status(201).json({ message: 'Loan record added successfully' });
  } catch (err) {
    console.error('POST /api/loans error:', err);
    res.status(400).json({ message: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

module.exports = router;
