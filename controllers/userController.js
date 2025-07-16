const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// ✅ Register User and Save Token
exports.registerUser = (req, res) => {
  const { name, age, address, email, contactNumber, password } = req.body;
  const profilePic = req.file ? req.file.filename : null;

  bcrypt.hash(password, 10, (err, hashedPwd) => {
    if (err) return res.status(500).json({ error: "Hashing failed" });

    const token = jwt.sign({ email }, process.env.JWT_SECRET || "defaultsecret", { expiresIn: "1d" });

    const sql = `
      INSERT INTO users (name, age, address, email, contactNumber, password, profilePic, token)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [name, age, address, email, contactNumber, hashedPwd, profilePic, token], (err) => {
      if (err) return res.status(500).json({ error: err });
      res.status(201).json({
        message: "User registered successfully",
        token,
        data: { name, email }
      });
    });
  });
};

// ✅ Login User and Return Token
exports.loginUser = (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (results.length === 0) return res.status(401).json({ message: "Invalid email" });

    const user = results[0];

    // 🚫 Block login if account is not active
    if (user.status !== 'active') {
      return res.status(403).json({ message: "Your account has been deactivated." });
    }

    bcrypt.compare(password, user.password, (err, match) => {
      if (err) return res.status(500).json({ error: err });
      if (!match) return res.status(401).json({ message: "Incorrect password" });

      const token = jwt.sign({ userID: user.userID, role: user.role }, process.env.JWT_SECRET || "defaultsecret", { expiresIn: '1d' });

      db.query("UPDATE users SET token = ? WHERE userID = ?", [token, user.userID], (err) => {
        if (err) return res.status(500).json({ error: err });

        res.json({
          message: "Login successful",
          token,
          user: {
            userID: user.userID,
            name: user.name,
            email: user.email,
            role: user.role,
            profilePic: user.profilePic
          }
        });
      });
    });
  });
};


// ✅ Get All Users (for Admin Panel / DataTable)
exports.getAllUsers = (req, res) => {
  db.query(
    "SELECT userID, name, age, address, email, contactNumber, role, status, profilePic FROM users",
    (err, results) => {
      if (err) return res.status(500).json({ error: err });
      res.json(results);
    }
  );
};

// ✅ Update Role (Admin Only)
exports.updateUserRole = (req, res) => {
  const { userID } = req.params;
  const { role } = req.body;

  db.query("UPDATE users SET role = ? WHERE userID = ?", [role, userID], (err) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ message: "Role updated" });
  });
};

// ✅ Activate/Deactivate User (Admin)
exports.toggleUserStatus = (req, res) => {
  const { userID } = req.params;
  const { status } = req.body;

  db.query("UPDATE users SET status = ? WHERE userID = ?", [status, userID], (err) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ message: "User status updated" });

    });   
};

// ✅ Logout User (Clear Token)
exports.logoutUser = (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  db.query("SELECT userID FROM users WHERE token = ?", [token], (err, results) => {
    if (err) return res.status(500).json({ error: err });

    if (results.length === 0) {
      return res.status(401).json({ message: "Invalid token" });
    }

    const userID = results[0].userID;

    db.query("UPDATE users SET token = NULL WHERE userID = ?", [userID], (err) => {
      if (err) return res.status(500).json({ error: err });
      res.json({ message: "Logged out successfully" });
    });
  });
};
