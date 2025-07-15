const jwt = require("jsonwebtoken");
const db = require("../config/db");

exports.isAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1]; // Bearer <token>

  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "defaultsecret");

    // Query DB to confirm user role
    db.query("SELECT role FROM users WHERE userID = ?", [decoded.userID], (err, results) => {
      if (err || results.length === 0)
        return res.status(403).json({ message: "Unauthorized" });

      const user = results[0];
      if (user.role !== "admin")
        return res.status(403).json({ message: "Admins only" });

      req.user = decoded; // attach decoded info if needed later
      next(); // allow access
    });
  } catch (err) {
    return res.status(403).json({ message: "Invalid token" });
  }
};
