const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path"); // ✅ Needed for correct file paths
const productRoutes = require("./routes/productRoutes");
const connectDB = require("./config/db");

dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public/
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

// ✅ Serve landing page at /api/
app.get("/api", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "landing.html"));
});

// Routes
app.use("/api", productRoutes);

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
