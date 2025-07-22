const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Get feedback for a specific email and orderID
router.get('/', (req, res) => {
  const { email, orderID } = req.query;

  if (!email || !orderID) {
    return res.status(400).json({ message: "Email and Order ID required." });
  }

  const sql = `
    SELECT f.feedbackID, f.productID, f.rating, f.feedback, p.name AS productName
    FROM feedback f
    JOIN products p ON f.productID = p.productID
    WHERE f.email = ? AND f.orderID = ?
  `;

  db.query(sql, [email, orderID], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });
    res.json(results);
  });
});
// Update a feedback entry by feedbackID
router.patch('/:id', (req, res) => {
  const feedbackID = req.params.id;
  const { feedback, rating } = req.body;

  if (!feedback && !rating) {
    return res.status(400).json({ message: "Nothing to update." });
  }

  const fields = [];
  const values = [];

  if (feedback) {
    fields.push("feedback = ?");
    values.push(feedback);
  }

  if (rating) {
    fields.push("rating = ?");
    values.push(rating);
  }

  values.push(feedbackID); // For WHERE clause

  const sql = `UPDATE feedback SET ${fields.join(', ')} WHERE feedbackID = ?`;

  db.query(sql, values, (err, result) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });
    if (result.affectedRows === 0) return res.status(404).json({ message: "Feedback not found" });
    res.json({ message: "Feedback updated successfully" });
  });
});

// DELETE a feedback by ID
router.delete('/:id', (req, res) => {
  const feedbackID = req.params.id;

  const sql = 'DELETE FROM feedback WHERE feedbackID = ?';
  db.query(sql, [feedbackID], (err, result) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Feedback not found" });
    }
    res.json({ message: "Feedback deleted successfully" });
  });
});


module.exports = router;
