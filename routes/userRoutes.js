const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const userController = require("../controllers/userController");
const { isAuthenticated, isAdmin, isAdminStrict, isOwnerOrAdmin } = require("../middlewares/auth");
const db = require("../config/db");

// Public routes (no authentication required)
router.post("/register", upload.single("profilePic"), userController.registerUser);
router.post("/login", userController.loginUser);

// Protected routes (authentication required)
router.post("/logout", isAuthenticated, userController.logoutUser);

// ✅ User-specific routes (user can access own data, admin can access any)
router.get('/users/:userID', isOwnerOrAdmin('userID'), (req, res) => {
  const { userID } = req.params;
  const sql = `SELECT userID, name, email, contactNumber, address, role, status FROM users WHERE userID = ?`;
  db.query(sql, [userID], (err, results) => {
    if (err) return res.status(500).json({ success: false, error: err });
    if (results.length === 0) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, user: results[0] });
  });
});

// ✅ Admin-only routes (strict authentication and detailed logging)
router.get("/users", isAdminStrict, userController.getAllUsers);
router.put("/users/:userID/role", isAdminStrict, userController.updateUserRole);
router.patch("/users/:userID/status", isAdminStrict, userController.toggleUserStatus);

module.exports = router;
