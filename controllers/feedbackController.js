const db = require("../config/db");

exports.submitFeedback = (req, res) => {
  const { orderID, productID, email, rating, feedback } = req.body;

  if (!orderID || !productID || !email || !rating) {
    return res.status(400).json({ message: "Missing fields." });
  }

  const sql = `INSERT INTO feedback (orderID, productID, email, rating, feedback)
               VALUES (?, ?, ?, ?, ?)`;

  db.query(sql, [orderID, productID, email, rating, feedback], (err, result) => {
    if (err) return res.status(500).json({ error: "Database error", err });
    res.status(201).json({ message: "Feedback submitted successfully" });
  });
};

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

exports.updateFeedback = (req, res) => {
  const feedbackID = req.params.id;
  const { feedback, rating } = req.body;

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

  if (fields.length === 0) return res.status(400).json({ message: "Nothing to update" });

  values.push(feedbackID);

  const sql = `UPDATE feedback SET ${fields.join(', ')} WHERE feedbackID = ?`;
  db.query(sql, values, (err, result) => {
    if (err) return res.status(500).json({ error: "Database error", err });
    res.json({ message: "Feedback updated" });
  });
};

exports.deleteFeedback = (req, res) => {
  const feedbackID = req.params.id;
  const sql = 'DELETE FROM feedback WHERE feedbackID = ?';

  db.query(sql, [feedbackID], (err, result) => {
    if (err) return res.status(500).json({ error: "Database error", err });
    res.json({ message: "Feedback deleted" });
  });
};


exports.getFeedbackByProduct = (req, res) => {
  const { productID } = req.params;
  if (!productID) {
    return res.status(400).json({ error: "Missing productID parameter" });
  }
  const sql = `
    SELECT f.feedbackID,
           f.rating,
           f.feedback,
           f.email
    FROM feedback f
    WHERE f.productID = ?
    ORDER BY f.feedbackID DESC
  `;
  db.query(sql, [productID], (err, results) => {
    if (err) {
      console.error("Error fetching feedback for product:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
};