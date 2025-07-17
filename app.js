const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const productRoutes = require("./routes/productRoutes");
const userRoutes = require("./routes/userRoutes"); // ✅ FIXED
const connectDB = require("./config/db");
const cartRoutes = require('./routes/cartRoutes');
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
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "landing.html"));
});

// ✅ Mount routes
app.use("/api", userRoutes);
app.use("/api", productRoutes);
app.use('/api/cart', cartRoutes);


// Start Server
const PORT = process.env.PORT || 5500;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
