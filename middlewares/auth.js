const jwt = require("jsonwebtoken");
const db = require("../config/db");

// ✅ Enhanced Bearer Token Authentication Middleware
exports.isAuthenticated = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ 
      success: false,
      message: "Access denied. Bearer token required." 
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "defaultsecret");

    // Verify token exists in database and user is active
    db.query(
      "SELECT userID, role, status, name, email FROM users WHERE userID = ? AND token = ?", 
      [decoded.userID, token], 
      (err, results) => {
        if (err) {
          return res.status(500).json({ 
            success: false,
            message: "Database error during authentication" 
          });
        }

        if (results.length === 0) {
          return res.status(401).json({ 
            success: false,
            message: "Invalid or expired token. Please login again." 
          });
        }

        const user = results[0];

        // Check if user account is active
        if (user.status !== 'active') {
          return res.status(403).json({ 
            success: false,
            message: "Account has been deactivated. Contact administrator." 
          });
        }

        // Attach user info to request object
        req.user = {
          userID: user.userID,
          role: user.role,
          name: user.name,
          email: user.email,
          token: token
        };

        next();
      }
    );
  } catch (err) {
    return res.status(401).json({ 
      success: false,
      message: "Invalid token format or expired token" 
    });
  }
};

// ✅ Enhanced Admin-Only Middleware (requires authentication first)
exports.isAdmin = (req, res, next) => {
  // First check if user is authenticated
  exports.isAuthenticated(req, res, (err) => {
    if (err) return; // Error already handled by isAuthenticated

    // Check if authenticated user has admin role
    if (req.user.role !== "admin") {
      return res.status(403).json({ 
        success: false,
        message: "Access denied. Administrator privileges required." 
      });
    }

    next(); // User is authenticated and is admin
  });
};

// ✅ Moderator or Admin Middleware
exports.isModerator = (req, res, next) => {
  exports.isAuthenticated(req, res, (err) => {
    if (err) return;

    if (req.user.role !== "admin" && req.user.role !== "moderator") {
      return res.status(403).json({ 
        success: false,
        message: "Access denied. Moderator or Administrator privileges required." 
      });
    }

    next();
  });
};

// ✅ Owner or Admin Middleware (for user-specific resources)
exports.isOwnerOrAdmin = (paramName = 'userID') => {
  return (req, res, next) => {
    exports.isAuthenticated(req, res, (err) => {
      if (err) return;

      const resourceUserID = req.params[paramName] || req.body[paramName];
      
      // Admin can access any resource
      if (req.user.role === "admin") {
        return next();
      }

      // User can only access their own resources
      if (req.user.userID.toString() === resourceUserID.toString()) {
        return next();
      }

      return res.status(403).json({ 
        success: false,
        message: "Access denied. You can only access your own resources." 
      });
    });
  };
};

// ✅ Enhanced Admin-Only Middleware with Detailed Logging
exports.isAdminStrict = (req, res, next) => {
  // First check if user is authenticated
  exports.isAuthenticated(req, res, (err) => {
    if (err) return; // Error already handled by isAuthenticated

    console.log(`🔐 Admin access attempt by user: ${req.user.name} (${req.user.role}) for ${req.method} ${req.originalUrl}`);

    // Check if authenticated user has admin role
    if (req.user.role !== "admin") {
      console.log(`❌ Access denied to ${req.user.name} - Role: ${req.user.role}, Required: admin`);
      
      return res.status(403).json({ 
        success: false,
        message: `Access denied. Administrator privileges required. Your role: ${req.user.role}`,
        redirectTo: "/home.html",
        userRole: req.user.role
      });
    }

    console.log(`✅ Admin access granted to ${req.user.name}`);
    next(); // User is authenticated and is admin
  });
};

// ✅ Frontend Page Protection Middleware (for HTML pages)
exports.requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  // If no auth header, it's likely a direct page access
  if (!authHeader) {
    // Check if it's an admin-only page by URL
    const adminPages = ['/createproduct.html', '/editproduct.html', '/viewproduct.html', '/admin-users.html'];
    const requestedPage = req.path;
    
    if (adminPages.some(page => requestedPage.includes(page))) {
      console.log(`🚫 Unauthorized access attempt to admin page: ${requestedPage}`);
      return res.redirect('/login.html');
    }
  }
  
  next();
};
