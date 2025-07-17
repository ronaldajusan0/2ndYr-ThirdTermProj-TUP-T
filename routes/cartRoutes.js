const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET cart with product info and total amount
router.get('/:userID', (req, res) => {
  const { userID } = req.params;
  const sql = `
    SELECT c.cartID, c.quantity, p.productID, p.name, p.price, p.brand,
           (p.price * c.quantity) AS totalItem
    FROM cart c
    JOIN products p ON c.productID = p.productID
    WHERE c.userID = ?
  `;
  db.query(sql, [userID], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    const totalAmount = results.reduce((sum, item) => sum + item.totalItem, 0);
    res.json({ items: results, totalAmount });
  });
});
router.put('/update', (req, res) => {
  const { cartID, quantity } = req.body;
  const sql = "UPDATE cart SET quantity=? WHERE cartID=?";
  db.query(sql, [quantity, cartID], (err) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ message: "Quantity updated." });
  });
});

// Add to cart
router.post('/', (req, res) => {
  const { userID, productID, quantity } = req.body;
  const sql = `
    INSERT INTO cart (userID, productID, quantity)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE quantity = quantity + ?
  `;
  db.query(sql, [userID, productID, quantity, quantity], (err) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ message: "Added to cart." });
  });
});

// Delete from cart
router.delete('/:cartID', (req, res) => {
  const { cartID } = req.params;
  db.query("DELETE FROM cart WHERE cartID=?", [cartID], (err) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ message: "Item removed from cart." });
  });
});

module.exports = router;
