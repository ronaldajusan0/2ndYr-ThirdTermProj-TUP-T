const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// ✅ Register User with Enhanced Error Handling
exports.registerUser = (req, res) => {
  const { name, age, address, email, contactNumber, password } = req.body;
  const profilePic = req.file ? req.file.filename : null;

  console.log("📝 Registration attempt for email:", email);

  // First check if email already exists
  db.query("SELECT email FROM users WHERE email = ?", [email], (err, existingUsers) => {
    if (err) {
      console.error("❌ Database error checking existing email:", err);
      return res.status(500).json({ error: "Database error occurred" });
    }

    if (existingUsers.length > 0) {
      console.log("❌ Email already registered:", email);
      return res.status(400).json({ error: "Email address is already registered. Please use a different email or try logging in." });
    }

    // Hash password and proceed with registration
    bcrypt.hash(password, 10, (err, hashedPwd) => {
      if (err) {
        console.error("❌ Password hashing failed:", err);
        return res.status(500).json({ error: "Password processing failed" });
      }

      const token = jwt.sign({ email }, process.env.JWT_SECRET || "defaultsecret", { expiresIn: "1d" });

      const sql = `
        INSERT INTO users (name, age, address, email, contactNumber, password, profilePic, token)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.query(sql, [name, age, address, email, contactNumber, hashedPwd, profilePic, token], (err) => {
        if (err) {
          console.error("❌ Registration database error:", err);
          
          // Handle specific MySQL errors
          if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: "Email address is already registered. Please use a different email." });
          }
          
          return res.status(500).json({ error: "Registration failed. Please try again." });
        }
        
        console.log("✅ User registered successfully:", email);
        res.status(201).json({
          message: "User registered successfully",
          token,
          data: { name, email }
        });
      });
    });
  });
};

// ✅ Enhanced Login User with New Bearer Token Generation
exports.loginUser = (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (err) return res.status(500).json({ success: false, error: err });
    if (results.length === 0) return res.status(401).json({ success: false, message: "Invalid email" });

    const user = results[0];

    // 🚫 Block login if account is not active
    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: "Your account has been deactivated." });
    }

    bcrypt.compare(password, user.password, (err, match) => {
      if (err) return res.status(500).json({ success: false, error: err });
      if (!match) return res.status(401).json({ success: false, message: "Incorrect password" });

      // ✅ Generate NEW bearer token for each login
      const newToken = jwt.sign(
        { 
          userID: user.userID, 
          role: user.role,
          loginTime: new Date().getTime() // Add timestamp for uniqueness
        }, 
        process.env.JWT_SECRET, 
        { expiresIn: '24h' }
      );

      // ✅ Update user's token in database (replace old token)
      db.query("UPDATE users SET token = ? WHERE userID = ?", [newToken, user.userID], (err) => {
        if (err) return res.status(500).json({ success: false, error: err });

        res.json({
          success: true,
          message: "Login successful",
          token: newToken,
          jwtToken: newToken, // For sessionStorage
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

// ✅ Enhanced Logout User (Clear Token from DB and Client)
exports.logoutUser = (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ 
      success: false, 
      message: "Unauthorized - Bearer token required" 
    });
  }

  const token = authHeader.split(" ")[1];

  // Find user by token
  db.query("SELECT userID, name FROM users WHERE token = ?", [token], (err, results) => {
    if (err) return res.status(500).json({ success: false, error: err });

    if (results.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid or expired token" 
      });
    }

    const user = results[0];

    // Clear token from database
    db.query("UPDATE users SET token = NULL WHERE userID = ?", [user.userID], (err) => {
      if (err) return res.status(500).json({ success: false, error: err });
      
      res.json({ 
        success: true, 
        message: "Logged out successfully",
        user: {
          name: user.name,
          userID: user.userID
        }
      });
    });
  });
};

// ✅ Client-side logout functionality (to be used in frontend)
exports.getLogoutScript = () => {
  return `
function logout() {
  const token = localStorage.getItem("token") || sessionStorage.getItem("jwtToken");
  
  if (!token) {
    // If no token, just clear storage and redirect
    localStorage.clear();
    sessionStorage.clear();
    alert("You have been logged out");
    window.location.href = "/login.html";
    return;
  }

  // Make API call to logout endpoint
  fetch("/api/logout", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json"
    }
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    } else {
      throw new Error("Logout failed");
    }
  })
  .then(data => {
    // Clear all storage items
    localStorage.clear();
    sessionStorage.clear();
    alert("You have been logged out successfully");
    window.location.href = "/login.html";
  })
  .catch(error => {
    console.error("Logout error:", error);
    // Even if logout fails, clear storage and redirect
    localStorage.clear();
    sessionStorage.clear();
    alert("Logged out (session cleared)");
    window.location.href = "/login.html";
  });
}

// Alternative simple logout (just clears storage)
function simpleLogout() {
  localStorage.clear();
  sessionStorage.clear();
  alert("You have been logged out");
  window.location.href = "/login.html";
}
  `;
};
