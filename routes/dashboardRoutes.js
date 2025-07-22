const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");
const { isAdminStrict } = require("../middlewares/auth");

// ✅ Dashboard Analytics Routes (Admin Only)
router.get("/dashboard/analytics", isAdminStrict, dashboardController.getDashboardData);
router.get("/dashboard/recent-orders", isAdminStrict, dashboardController.getRecentOrders);
router.get("/dashboard/low-stock", isAdminStrict, dashboardController.getLowStockProducts);

module.exports = router;
