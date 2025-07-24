const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");

const productRoutes = require("./routes/productRoutes");
const userRoutes = require("./routes/userRoutes");
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const feedbackRoutes = require("./routes/feedbackRoutes");


dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Note: Frontend protection is handled by client-side JavaScript in each page
// Server-side protection is only for API endpoints

app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

app.get("/api", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "landing.html"));
});


app.use('/api/feedback', feedbackRoutes);
app.use("/api", userRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api', dashboardRoutes);
app.use("/api", productRoutes);
app.use('/api/orders', orderRoutes);
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


