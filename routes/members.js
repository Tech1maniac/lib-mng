const express = require('express');
const { oracledb } = require('../config/db');
const router = express.Router();

// GET /api/members - Fetch all members
router.get('/', async (req, res) => {
  let conn;
  try {
    conn = await oracledb.getConnection();
    const result = await conn.execute(
      `SELECT member_id, user_id, TO_CHAR(membership_start_date, 'YYYY-MM-DD') AS membership_start_date,
              TO_CHAR(membership_end_date, 'YYYY-MM-DD') AS membership_end_date,
              current_loan_count, can_borrow, member_type
       FROM members
       ORDER BY member_id`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/members error:', err);
    res.status(500).json({ message: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

// GET /api/members/search?q=
router.get('/search', async (req, res) => {
  let conn;
  const { q } = req.query;
  const search = q ? `%${q.toLowerCase()}%` : '%';

  try {
    conn = await oracledb.getConnection();
    const result = await conn.execute(
      `SELECT member_id, user_id,
              TO_CHAR(membership_start_date, 'YYYY-MM-DD') AS membership_start_date,
              TO_CHAR(membership_end_date, 'YYYY-MM-DD') AS membership_end_date,
              current_loan_count, can_borrow, member_type
       FROM members
       WHERE LOWER(member_type) LIKE :search
          OR TO_CHAR(user_id) LIKE :search
       ORDER BY member_id`,
      { search },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/members/search error:', err);
    res.status(500).json({ message: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

// POST /api/members - Add new member
router.post('/', async (req, res) => {
  const { user_id, membership_start_date, membership_end_date, member_type } = req.body;
  let conn;

  try {
    conn = await oracledb.getConnection();
    await conn.execute(
      `INSERT INTO members (
         user_id,
         membership_start_date,
         membership_end_date,
         member_type
       ) VALUES (
         :user_id,
         TO_DATE(:start_date, 'YYYY-MM-DD'),
         TO_DATE(:end_date, 'YYYY-MM-DD'),
         :member_type
       )`,
      {
        user_id: Number(user_id),
        start_date: membership_start_date,
        end_date: membership_end_date,
        member_type
      },
      { autoCommit: true }
    );
    res.status(201).json({ message: 'Member added successfully' });
  } catch (err) {
    console.error('POST /api/members error:', err);
    res.status(400).json({ message: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

module.exports = router;
