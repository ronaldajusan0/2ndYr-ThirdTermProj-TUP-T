const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const userController = require("../controllers/userController");
const { isAdmin } = require("../middlewares/auth");

// Register user with profile picture upload
router.post("/register", upload.single("profilePic"), userController.registerUser);

// Login route
router.post("/login", userController.loginUser);

// Admin features
router.get("/users", userController.getAllUsers);
router.put("/users/:userID/role", isAdmin, userController.updateUserRole);
router.patch("/users/:userID/status", isAdmin, userController.toggleUserStatus);

router.post("/logout", userController.logoutUser);
module.exports = router;
