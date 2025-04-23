const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Assuming you have a db.js file that exports the database connection

// Route to get all members
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM members');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching members:', err);
    res.status(500).json({ message: 'Error fetching members' });
  }
});

// Route to search members by a query
router.get('/search', async (req, res) => {
  const searchTerm = req.query.q;
  if (!searchTerm) {
    return res.status(400).json({ message: 'Search term is required' });
  }
  try {
    const result = await db.query(
      'SELECT * FROM members WHERE user_id::text LIKE $1 OR member_type LIKE $1',
      [`%${searchTerm}%`]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error searching members:', err);
    res.status(500).json({ message: 'Error searching members' });
  }
});

// Route to add a new member
router.post('/', async (req, res) => {
  const { user_id, membership_start_date, membership_end_date, current_loan_count, can_borrow, member_type } = req.body;

  if (!user_id || !membership_start_date || !membership_end_date || !current_loan_count || can_borrow === undefined || !member_type) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const result = await db.query(
      `INSERT INTO members (user_id, membership_start_date, membership_end_date, current_loan_count, can_borrow, member_type)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [user_id, membership_start_date, membership_end_date, current_loan_count, can_borrow, member_type]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding member:', err);
    res.status(500).json({ message: 'Error adding member' });
  }
});

// Route to update a member
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { user_id, membership_start_date, membership_end_date, current_loan_count, can_borrow, member_type } = req.body;

  if (!user_id || !membership_start_date || !membership_end_date || !current_loan_count || can_borrow === undefined || !member_type) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const result = await db.query(
      `UPDATE members
      SET user_id = $1, membership_start_date = $2, membership_end_date = $3, current_loan_count = $4, can_borrow = $5, member_type = $6
      WHERE member_id = $7 RETURNING *`,
      [user_id, membership_start_date, membership_end_date, current_loan_count, can_borrow, member_type, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Member not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating member:', err);
    res.status(500).json({ message: 'Error updating member' });
  }
});

// Route to delete a member
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query('DELETE FROM members WHERE member_id = $1 RETURNING *', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Member not found' });
    }

    res.json({ message: 'Member deleted successfully' });
  } catch (err) {
    console.error('Error deleting member:', err);
    res.status(500).json({ message: 'Error deleting member' });
  }
});

module.exports = router;
