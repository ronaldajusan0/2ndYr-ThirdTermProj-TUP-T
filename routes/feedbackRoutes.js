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

module.exports = router;
