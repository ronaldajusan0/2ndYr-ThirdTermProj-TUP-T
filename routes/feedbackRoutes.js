const express = require('express');
const router = express.Router();
const db = require('../config/db');
const feedbackController = require('../controllers/feedbackController');

router.post('/', feedbackController.submitFeedback);
router.get('/', feedbackController.getFeedbackByUser);
router.get('/product/:productID', feedbackController.getFeedbackByProduct);
// Get feedback for a specific email and orderID
// Get feedback for a specific email, orderID, and productID
// controllers/feedbackController.js

exports.getFeedbackByUser = (req, res) => {
  const { email, orderID } = req.query;

  if (!email || !orderID) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  const sql = `
    SELECT f.feedbackID, f.productID, f.rating, f.feedback, p.name AS productName
    FROM feedback f
    JOIN products p ON f.productID = p.productID
    WHERE f.email = ? AND f.orderID = ?
  `;

  db.query(sql, [email, orderID], (err, results) => {
    if (err) {
      console.error("Error fetching feedback:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
};



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

router.post('/', feedbackController.submitFeedback);
router.get('/', feedbackController.getFeedbackByUser);
router.patch('/:id', feedbackController.updateFeedback); // move this logic to controller too (optional)
router.delete('/:id', feedbackController.deleteFeedback);
module.exports = router;
