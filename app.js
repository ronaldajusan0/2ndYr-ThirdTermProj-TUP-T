const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const productRoutes = require("./routes/productRoutes");
const userRoutes = require("./routes/userRoutes"); // ✅ FIXED
const connectDB = require("./config/db");

dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));
app.use(express.urlencoded({ extended: true })); // needed for form parsing


// ✅ Serve landing page first
app.get("/api", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "landing.html"));
});

// ✅ Mount routes
app.use("/api", userRoutes);
app.use("/api", productRoutes);

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
