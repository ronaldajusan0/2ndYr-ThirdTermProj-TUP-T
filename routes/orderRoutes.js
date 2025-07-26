const express = require("express");
const router = express.Router();
const db = require("../config/db");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const orderController = require("../controllers/orderController");

const { isAuthenticated, isAdmin, isOwnerOrAdmin } = require("../middlewares/auth");

// Mailtrap transporter
const transporter = nodemailer.createTransport({
  host: "sandbox.smtp.mailtrap.io",
  port: 2525,
  auth: {
    user: "99190548971850",
    pass: "591d206203a0fd"
  }
});

// CREATE ORDER
router.post("/create", isAuthenticated, (req, res) => {
  const { userID, paymentMethod, address, items, userEmail } = req.body;

  if (req.user.role !== "admin" && req.user.userID.toString() !== userID.toString()) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }
  if (!userID || !paymentMethod || !address || !items || !items.length) {
    return res.status(400).json({ success: false, message: "Missing data." });
  }

  db.query(
    "INSERT INTO orders (userID, paymentMethod, shippingAddress, status) VALUES (?, ?, ?, 'confirmed')",
    [userID, paymentMethod, address],
    (err, orderResult) => {
      if (err) return res.status(500).json({ error: err });
      const orderID = orderResult.insertId;
      let inserted = 0;
      let orderItems = [];

      // Insert each order line
      items.forEach(item => {
        const lineTotal = item.quantity * item.price;
        db.query(
          `INSERT INTO orderinfo (orderID, productID, quantity, priceAtPurchase, lineTotal)
           VALUES (?, ?, ?, ?, ?)`,
          [orderID, item.productID, item.quantity, item.price, lineTotal],
          err => {
            if (err) return res.status(500).json({ error: err });
            orderItems.push(item);
            inserted++;

            // When all items are inserted
            if (inserted === items.length) {
              // Decrement stock for each purchased item
              const stockSql = `UPDATE products
                                  SET quantity = GREATEST(quantity - ?, 0)
                                WHERE productID = ?`;
              orderItems.forEach(prod => {
                db.query(stockSql, [prod.quantity, prod.productID], stockErr => {
                  if (stockErr) console.error("⚠️ Stock update error for product", prod.productID, stockErr);
                });
              });

              // Clear the user's cart
              db.query("DELETE FROM cart WHERE userID = ?", [userID], cartErr => {
                if (cartErr) console.error(cartErr);

                // Generate and send PDF receipt
                const doc = new PDFDocument();
                let buffers = [];
                doc.on("data", buffers.push.bind(buffers));
                doc.on("end", () => {
                  const pdfBuffer = Buffer.concat(buffers);
                  transporter.sendMail({
                    from: '"My Shop" <noreply@myshop.com>',
                    to: userEmail,
                    subject: `Order Confirmation - Order #${orderID}`,
                    text: `Thank you for your order! PDF receipt is attached.`,
                    attachments: [{ filename: `receipt-${orderID}.pdf`, content: pdfBuffer }]
                  }, emailErr => {
                    if (emailErr) console.error("Email send error", emailErr);
                    res.status(201).json({ success: true, orderID });
                  });
                });

                doc.fontSize(18).text(`Receipt - Order #${orderID}`, { underline: true });
                doc.moveDown();
                doc.fontSize(12).text(`Payment Method: ${paymentMethod.toUpperCase()}`);
                doc.text(`Shipping Address: ${address}`);
                doc.moveDown().text("Items:");

                let total = 0;
                orderItems.forEach(prod => {
                  const subtotal = prod.price * prod.quantity;
                  total += subtotal;
                  doc.text(`- ${prod.name || `Product #${prod.productID}`} x${prod.quantity} @ ₱${prod.price.toFixed(2)} = ₱${subtotal.toFixed(2)}`);
                });
                doc.moveDown().text(`Total: ₱${total.toFixed(2)}`);
                doc.end();
              });
            }
          }
        );
      });
    }
  );
});

// UPDATE STATUS + OPTIONAL DELIVERY RECEIPT
router.patch("/:id/status", (req, res) => {
  const { id } = req.params;
  const { status, email } = req.body;

  db.query("UPDATE orders SET status = ? WHERE orderID = ?", [status, id], err => {
    if (err) return res.status(500).json({ error: err });

    if (status === "delivered") {
      // Fetch line items
      const sql = `
        SELECT oi.productID, oi.quantity, o.paymentMethod, o.shippingAddress, p.name
        FROM orders o
        JOIN orderinfo oi ON o.orderID = oi.orderID
        JOIN products p ON oi.productID = p.productID
        WHERE o.orderID = ?`;
      db.query(sql, [id], (err, results) => {
        if (err) return res.status(500).json({ error: err });

        // Decrement stock again in case of late adjustments
        const stockSql = `UPDATE products
                            SET quantity = GREATEST(quantity - ?, 0)
                          WHERE productID = ?`;
        results.forEach(row => {
          db.query(stockSql, [row.quantity, row.productID], stockErr => {
            if (stockErr) console.error("⚠️ Stock update error", stockErr);
          });
        });

        // (Optional) generate delivery receipt PDF and email
        // ... existing PDF logic ...

        return res.json({ message: "Order delivered and stock updated." });
      });
    } else {
      // Non-delivery notifications
      transporter.sendMail({
        from: '"My Shop" <noreply@myshop.com>',
        to: email,
        subject: `Order ${status.toUpperCase()}`,
        text: `Your order #${id} has been ${status}.`
      }, mailErr => {
        if (mailErr) console.error(mailErr);
        res.json({ message: `Order ${status}. Email sent.` });
      });
    }
  });
});

// GET ORDER INFO
router.get("/orderinfo/:orderID", (req, res) => {
  const { orderID } = req.params;
  const sql = `
    SELECT o.orderID, o.status, o.shippingAddress,
           oi.productID, oi.quantity, oi.priceAtPurchase,
           p.name
    FROM orders o
    JOIN orderinfo oi ON o.orderID = oi.orderID
    JOIN products p ON oi.productID = p.productID
    WHERE o.orderID = ?`;
  db.query(sql, [orderID], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (!results.length) return res.status(404).json({ message: "Order not found." });
    const order = {
      orderID: results[0].orderID,
      status: results[0].status,
      shippingAddress: results[0].shippingAddress,
      items: results.map(r => ({ productID: r.productID, name: r.name, quantity: r.quantity, priceAtPurchase: r.priceAtPurchase }))
    };
    res.json(order);
  });
});

// GET ORDER HISTORY
router.get('/history/:userID', isAuthenticated, orderController.getOrderHistory);

module.exports = router;
