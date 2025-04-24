// routes/members.js
const express = require("express");
const { oracledb } = require("../config/db");
const router = express.Router();

// Middleware to protect routes
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

// GET /api/members - Fetch all members
router.get("/", async (req, res) => {
  let conn;
  try {
    conn = await oracledb.getConnection();
    const result = await conn.execute(
      `SELECT member_id,
              user_id,
              TO_CHAR(membership_start_date, 'YYYY-MM-DD') AS membership_start_date,
              TO_CHAR(membership_end_date,   'YYYY-MM-DD') AS membership_end_date,
              current_loan_count,
              can_borrow,
              member_type
       FROM members
       ORDER BY member_id`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.json(result.rows);
  } catch (err) {
    console.error("GET /api/members error:", err);
    res.status(500).json({ message: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

// GET /api/members/search?q= - Search members
router.get("/search", async (req, res) => {
  let conn;
  const { q } = req.query;
  const search = q ? `%${q.toLowerCase()}%` : "%";

  try {
    conn = await oracledb.getConnection();
    const result = await conn.execute(
      `SELECT member_id,
              user_id,
              TO_CHAR(membership_start_date, 'YYYY-MM-DD') AS membership_start_date,
              TO_CHAR(membership_end_date,   'YYYY-MM-DD') AS membership_end_date,
              current_loan_count,
              can_borrow,
              member_type
       FROM members
       WHERE LOWER(member_type) LIKE :search
          OR TO_CHAR(user_id) LIKE :search
       ORDER BY member_id`,
      { search },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.json(result.rows);
  } catch (err) {
    console.error("GET /api/members/search error:", err);
    res.status(500).json({ message: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

// POST /api/members - Add new member
router.post("/", async (req, res) => {
  const { user_id, membership_start_date, membership_end_date, member_type } =
    req.body;
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
         TO_DATE(:end_date,   'YYYY-MM-DD'),
         :member_type
       )`,
      {
        user_id: Number(user_id),
        start_date: membership_start_date,
        end_date: membership_end_date,
        member_type,
      },
      { autoCommit: true }
    );
    res.status(201).json({ message: "Member added successfully" });
  } catch (err) {
    console.error("POST /api/members error:", err);
    res.status(400).json({ message: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

// GET /api/members/borrowed - Fetch borrowed books for logged-in member
// GET /api/members/borrowed — returns loans+book info for logged-in member
router.get('/borrowed', requireLogin, async (req, res) => {
  let conn;

  try {
    conn = await oracledb.getConnection();

    // Step 1: Get member_id from user_id
    const memberQuery = `
      SELECT member_id
      FROM members
      WHERE user_id = :userId
    `;

    const memberResult = await conn.execute(
      memberQuery,
      { userId: req.session.userId }, // bind userId
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (!memberResult.rows.length) {
      return res.status(404).json({ message: 'Member not found' });
    }

    const memberId = memberResult.rows[0].MEMBER_ID;

    // Step 2: Get borrowed books for that member
    const loansQuery = `
      SELECT
        l.loan_id,
        l.loan_date,
        l.due_date,
        l.return_date,
        l.fine,
        b.book_id,
        b.title,
        b.isbn,
        b.year_published,
        b.publisher_id
      FROM loans l
      JOIN books b ON l.book_id = b.book_id
      WHERE l.member_id = :memberId
      ORDER BY l.loan_date DESC
    `;

    const loansResult = await conn.execute(
      loansQuery,
      { memberId: memberId }, // bind memberId
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    // Step 3: Format dates to YYYY-MM-DD
    const formattedLoans = loansResult.rows.map(row => ({
      loan_id: row.LOAN_ID,
      loan_date: row.LOAN_DATE ? row.LOAN_DATE.toISOString().split('T')[0] : null,
      due_date: row.DUE_DATE ? row.DUE_DATE.toISOString().split('T')[0] : null,
      return_date: row.RETURN_DATE ? row.RETURN_DATE.toISOString().split('T')[0] : null,
      fine: row.FINE,
      book_id: row.BOOK_ID,
      title: row.TITLE,
      isbn: row.ISBN,
      year_published: row.YEAR_PUBLISHED,
      publisher_id: row.PUBLISHER_ID
    }));

    res.json(formattedLoans);

  } catch (err) {
    console.error('GET /api/members/borrowed error:', err);
    res.status(500).json({ message: err.message });
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (err) {
        console.error('Failed to close Oracle connection', err);
      }
    }
  }
});

module.exports = router;