const db = require("../config/db");
const nodemailer = require("nodemailer");

// Mailtrap transporter setup
const transporter = nodemailer.createTransport({
  host: "smtp.mailtrap.io",
  port: 587,
  auth: {
    user: "9ad95f834041f2",
    pass: "933176ce1c3ce6"
  }
});

// Email helper
const sendEmail = async (to, subject, text) => {
  await transporter.sendMail({
    from: '"Your Store" <noreply@yourstore.com>',
    to,
    subject,
    text
  });
};

exports.createOrder = async (req, res) => {
  const { userID, paymentMethod, address, items, userEmail } = req.body;

  if (!userID || !paymentMethod || !address || !items || !items.length) {
    return res.status(400).json({ success: false, message: "Missing order data." });
  }

  try {
    const [orderResult] = await db.promise().query(
      "INSERT INTO orders (userID, paymentMethod, shippingAddress, status) VALUES (?, ?, ?, 'confirmed')",
      [userID, paymentMethod, address]
    );

    const orderID = orderResult.insertId;

    for (const item of items) {
      await db.promise().query(
        "INSERT INTO orderinfo (orderID, productID, quantity, priceAtPurchase) VALUES (?, ?, ?, ?)",
        [orderID, item.productID, item.quantity, item.price]
      );
    }

    // Send email to customer after order is placed
    if (userEmail) {
      const subject = `Order Confirmation - Order #${orderID}`;
      const text = `
Thank you for your order!

Order ID: ${orderID}
Payment Method: ${paymentMethod}
Shipping Address: ${address}
Number of Items: ${items.length}

We will notify you once the order is shipped.
      `.trim();

      try {
        await sendEmail(userEmail, subject, text);
      } catch (emailErr) {
        console.error("Failed to send confirmation email:", emailErr);
        // Still continue even if email fails
      }
    }

    return res.status(201).json({ success: true, orderID });
  } catch (err) {
    console.error("Order creation error:", err);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};


// GET /api/orders/history/:userID
exports.getOrderHistory = (req, res) => {
  const { userID } = req.params;

  const sql = `
    SELECT 
      o.orderID,
      o.orderDate,
      o.paymentMethod,
      o.shippingAddress,
      o.status,
      oi.productID,
      oi.quantity,
      oi.priceAtPurchase,
      p.name AS productName
    FROM orders o
    JOIN orderinfo oi ON o.orderID = oi.orderID
    JOIN products p   ON oi.productID = p.productID
    WHERE o.userID = ?
    ORDER BY o.orderDate DESC
  `;

  db.query(sql, [userID], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });

    // group rows by orderID
    const ordersMap = {};
    rows.forEach(r => {
      if (!ordersMap[r.orderID]) {
        ordersMap[r.orderID] = {
          orderID:        r.orderID,
          orderDate:      r.orderDate,
          paymentMethod:  r.paymentMethod,
          shippingAddress:r.shippingAddress,
          status:         r.status,
          totalAmount:    0,
          items:          []
        };
      }
      const ord = ordersMap[r.orderID];
      ord.items.push({
        productID:       r.productID,
        name:            r.productName,
        quantity:        r.quantity,
        priceAtPurchase: r.priceAtPurchase
      });
      ord.totalAmount += r.quantity * r.priceAtPurchase;
    });

    res.json({
      success: true,
      orders: Object.values(ordersMap)
    });
  });
};
