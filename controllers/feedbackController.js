const db = require("../config/db");

exports.submitFeedback = (req, res) => {
  const { orderID, productID, email, rating, feedback } = req.body;

  console.log("Received feedback:", req.body); // ✅ Debug log

  if (!orderID || !productID || !email || !rating) {
    return res.status(400).json({ message: "Missing fields." });
  }

  const sql = `INSERT INTO feedback (orderID, productID, email, rating, feedback) VALUES (?, ?, ?, ?, ?)`;
  db.query(sql, [orderID, productID, email, rating, feedback], (err, result) => {
    if (err) {
      console.error("❌ MySQL Insert Error:", err); // ✅ Log any MySQL errors
      return res.status(500).json({ error: "Database error" });
    }
    res.status(201).json({ message: "✅ Feedback submitted successfully." });
  });
};
