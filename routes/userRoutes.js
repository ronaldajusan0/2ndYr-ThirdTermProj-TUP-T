const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const userController = require("../controllers/userController");

// Register user with profile picture upload
router.post("/register", upload.single("profilePic"), userController.registerUser);

// Login route
router.post("/login", userController.loginUser);

// Admin features
router.get("/users", userController.getAllUsers);
router.patch("/users/:userID/role", userController.updateUserRole);
router.patch("/users/:userID/status", userController.toggleUserStatus);

module.exports = router;
