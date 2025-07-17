const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const userController = require("../controllers/userController");
const { isAdmin } = require("../middlewares/auth");
const db = require("../config/db"); // ✅ ADD THIS LINE

// Register user with profile picture upload
router.post("/register", upload.single("profilePic"), userController.registerUser);

// Login route
router.post("/login", userController.loginUser);

// ✅ Get user details by ID
router.get('/users/:userID', (req, res) => {
  const { userID } = req.params;
  const sql = `SELECT userID, name, email, contactNumber, address FROM users WHERE userID = ?`;
  db.query(sql, [userID], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (results.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(results[0]);
  });
});

// Admin features
router.get("/users", userController.getAllUsers);
router.put("/users/:userID/role", isAdmin, userController.updateUserRole);
router.patch("/users/:userID/status", isAdmin, userController.toggleUserStatus);

// Logout route
router.post("/logout", userController.logoutUser);

module.exports = router;
