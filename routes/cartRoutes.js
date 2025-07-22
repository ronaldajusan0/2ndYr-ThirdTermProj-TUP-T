const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAuthenticated, isOwnerOrAdmin } = require('../middlewares/auth');

// ✅ Protected cart routes (user can only access their own cart)
router.get('/:userID', isOwnerOrAdmin('userID'), (req, res) => {
  const { userID } = req.params;
  const sql = `
    SELECT c.cartID, c.quantity, p.productID, p.name, p.price, p.brand,
           (p.price * c.quantity) AS totalItem
    FROM cart c
    JOIN products p ON c.productID = p.productID
    WHERE c.userID = ?
  `;
  db.query(sql, [userID], (err, results) => {
    if (err) return res.status(500).json({ success: false, error: err });
    const totalAmount = results.reduce((sum, item) => sum + item.totalItem, 0);
    res.json({ success: true, items: results, totalAmount });
  });
});

router.put('/update', isAuthenticated, (req, res) => {
  const { cartID, quantity } = req.body;
  
  // Verify cart belongs to authenticated user
  const checkSql = "SELECT userID FROM cart WHERE cartID = ?";
  db.query(checkSql, [cartID], (err, results) => {
    if (err) return res.status(500).json({ success: false, error: err });
    if (results.length === 0) return res.status(404).json({ success: false, message: "Cart item not found" });
    
    // Check if user owns this cart item (admin can update any)
    if (req.user.role !== "admin" && results[0].userID !== req.user.userID) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    
    const sql = "UPDATE cart SET quantity=? WHERE cartID=?";
    db.query(sql, [quantity, cartID], (err) => {
      if (err) return res.status(500).json({ success: false, error: err });
      res.json({ success: true, message: "Quantity updated." });
    });
  });
});

// Add to cart (authenticated users only)
router.post('/', isAuthenticated, (req, res) => {
  const { userID, productID, quantity } = req.body;
  
  // Verify user can only add to their own cart (admin can add to any)
  if (req.user.role !== "admin" && req.user.userID.toString() !== userID.toString()) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }
  
  const sql = `
    INSERT INTO cart (userID, productID, quantity)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE quantity = quantity + ?
  `;
  db.query(sql, [userID, productID, quantity, quantity], (err) => {
    if (err) return res.status(500).json({ success: false, error: err });
    res.json({ success: true, message: "Added to cart." });
  });
});

// Delete from cart (authenticated users only)
router.delete('/:cartID', isAuthenticated, (req, res) => {
  const { cartID } = req.params;
  
  // Verify cart belongs to authenticated user
  const checkSql = "SELECT userID FROM cart WHERE cartID = ?";
  db.query(checkSql, [cartID], (err, results) => {
    if (err) return res.status(500).json({ success: false, error: err });
    if (results.length === 0) return res.status(404).json({ success: false, message: "Cart item not found" });
    
    // Check if user owns this cart item (admin can delete any)
    if (req.user.role !== "admin" && results[0].userID !== req.user.userID) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    
    db.query("DELETE FROM cart WHERE cartID=?", [cartID], (err) => {
      if (err) return res.status(500).json({ success: false, error: err });
      res.json({ success: true, message: "Item removed from cart." });
    });
  });
});

module.exports = router;
