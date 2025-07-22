const db = require("../config/db");

// ✅ Dashboard Analytics Controller
exports.getDashboardData = (req, res) => {
  console.log("📊 Fetching dashboard analytics data...");
  
  // Execute multiple queries in parallel
  const queries = {
    // 📈 Sales data for line chart (monthly sales)
    monthlySales: `
      SELECT 
        DATE_FORMAT(o.orderDate, '%Y-%m') as month,
        COUNT(o.orderID) as orderCount,
        SUM(oi.quantity * oi.priceAtPurchase) as totalRevenue
      FROM orders o
      JOIN orderinfo oi ON o.orderID = oi.orderID
      WHERE o.orderDate >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(o.orderDate, '%Y-%m')
      ORDER BY month ASC
    `,
    
    // 📊 Order status distribution for pie chart
    orderStatusDistribution: `
      SELECT 
        status,
        COUNT(*) as count
      FROM orders
      GROUP BY status
    `,
    
    // 📊 Top selling products for bar chart
    topProducts: `
      SELECT 
        p.name,
        p.brand,
        SUM(oi.quantity) as totalSold,
        SUM(oi.quantity * oi.priceAtPurchase) as revenue
      FROM products p
      JOIN orderinfo oi ON p.productID = oi.productID
      JOIN orders o ON oi.orderID = o.orderID
      GROUP BY p.productID, p.name, p.brand
      ORDER BY totalSold DESC
      LIMIT 10
    `,
    
    // 📊 User registration trends (monthly)
    userRegistrations: `
      SELECT 
        DATE_FORMAT(FROM_UNIXTIME(UNIX_TIMESTAMP()), '%Y-%m') as month,
        COUNT(*) as newUsers
      FROM users
      WHERE userID > 0
      GROUP BY DATE_FORMAT(FROM_UNIXTIME(UNIX_TIMESTAMP()), '%Y-%m')
      ORDER BY month ASC
      LIMIT 12
    `,
    
    // 📊 Revenue by payment method
    paymentMethodRevenue: `
      SELECT 
        o.paymentMethod,
        COUNT(o.orderID) as orderCount,
        SUM(oi.quantity * oi.priceAtPurchase) as totalRevenue
      FROM orders o
      JOIN orderinfo oi ON o.orderID = oi.orderID
      GROUP BY o.paymentMethod
    `,
    
    // 📊 Product availability status
    productAvailability: `
      SELECT 
        CASE 
          WHEN availability = 1 THEN 'Available'
          ELSE 'Unavailable'
        END as status,
        COUNT(*) as count
      FROM products
      GROUP BY availability
    `,
    
    // 📊 Summary statistics
    summaryStats: `
      SELECT 
        (SELECT COUNT(*) FROM users WHERE role = 'user') as totalUsers,
        (SELECT COUNT(*) FROM users WHERE role = 'admin') as totalAdmins,
        (SELECT COUNT(*) FROM products) as totalProducts,
        (SELECT COUNT(*) FROM orders) as totalOrders,
        (SELECT SUM(oi.quantity * oi.priceAtPurchase) FROM orderinfo oi JOIN orders o ON oi.orderID = o.orderID) as totalRevenue,
        (SELECT COUNT(*) FROM orders WHERE status = 'pending') as pendingOrders
    `
  };

  const results = {};
  let completedQueries = 0;
  const totalQueries = Object.keys(queries).length;

  // Execute all queries
  Object.keys(queries).forEach(queryName => {
    db.query(queries[queryName], (err, data) => {
      if (err) {
        console.error(`❌ Error in ${queryName} query:`, err);
        results[queryName] = [];
      } else {
        console.log(`✅ ${queryName} query completed:`, data.length, 'records');
        results[queryName] = data;
      }
      
      completedQueries++;
      
      // Send response when all queries are complete
      if (completedQueries === totalQueries) {
        console.log("✅ All dashboard queries completed");
        res.json({
          success: true,
          data: results,
          timestamp: new Date().toISOString()
        });
      }
    });
  });
};

// ✅ Get Recent Orders for Dashboard
exports.getRecentOrders = (req, res) => {
  const query = `
    SELECT 
      o.orderID,
      o.orderDate,
      u.name as userName,
      o.paymentMethod,
      o.status,
      SUM(oi.quantity * oi.priceAtPurchase) as totalAmount
    FROM orders o
    JOIN users u ON o.userID = u.userID
    JOIN orderinfo oi ON o.orderID = oi.orderID
    GROUP BY o.orderID, o.orderDate, u.name, o.paymentMethod, o.status
    ORDER BY o.orderDate DESC
    LIMIT 10
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("❌ Error fetching recent orders:", err);
      return res.status(500).json({ error: "Failed to fetch recent orders" });
    }
    
    console.log("✅ Recent orders fetched:", results.length);
    res.json(results);
  });
};

// ✅ Get Low Stock Products Alert
exports.getLowStockProducts = (req, res) => {
  const query = `
    SELECT 
      productID,
      name,
      brand,
      quantity,
      price
    FROM products
    WHERE quantity <= 5 AND availability = 1
    ORDER BY quantity ASC
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("❌ Error fetching low stock products:", err);
      return res.status(500).json({ error: "Failed to fetch low stock products" });
    }
    
    console.log("✅ Low stock products fetched:", results.length);
    res.json(results);
  });
};
