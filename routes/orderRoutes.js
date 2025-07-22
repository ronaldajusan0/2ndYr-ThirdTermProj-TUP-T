const express = require("express");
const router = express.Router();
const db = require("../config/db");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const { isAuthenticated, isAdmin, isOwnerOrAdmin } = require("../middlewares/auth");

const transporter = nodemailer.createTransport({
  host: "smtp.mailtrap.io",
  port: 587,
  auth: {
    user: "9ad95f834041f2",
    pass: "933176ce1c3ce6"
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

      items.forEach((item) => {
        db.query(
          "INSERT INTO orderinfo (orderID, productID, quantity, priceAtPurchase) VALUES (?, ?, ?, ?)",
          [orderID, item.productID, item.quantity, item.price],
          (err) => {
            if (err) return res.status(500).json({ error: err });
            orderItems.push(item);
            inserted++;

            if (inserted === items.length) {
              db.query("DELETE FROM cart WHERE userID = ?", [userID], (err) => {
                if (err) return res.status(500).json({ error: err });

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
                  }, (err) => {
                    if (err) return res.status(500).json({ error: err });
                    return res.json({ success: true, orderID });
                  });
                });

                doc.fontSize(18).text(`Receipt - Order #${orderID}`, { underline: true });
                doc.moveDown();
                doc.fontSize(12).text(`Payment Method: ${paymentMethod.toUpperCase()}`);
                doc.text(`Shipping Address: ${address}`);
                doc.moveDown().text("Items:");

                let total = 0;
                orderItems.forEach((item) => {
                  const subtotal = item.price * item.quantity;
                  total += subtotal;
                  doc.text(`- ${item.name || `Product #${item.productID}`} x${item.quantity} @ ₱${item.price.toFixed(2)} = ₱${subtotal.toFixed(2)}`);
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

// UPDATE STATUS + SEND PDF OR NOTIFY
router.patch("/:id/status", (req, res) => {
  const { id } = req.params;
  const { status, email } = req.body;

  console.log("PATCH BODY:", req.body);

  db.query("UPDATE orders SET status = ? WHERE orderID = ?", [status, id], (err) => {
    if (err) return res.status(500).json({ error: err });

    if (status === "delivered") {
      const sql = `
        SELECT o.orderID, o.paymentMethod, o.shippingAddress,
               oi.quantity, oi.priceAtPurchase, p.name
        FROM orders o
        JOIN orderinfo oi ON o.orderID = oi.orderID
        JOIN products p ON oi.productID = p.productID
        WHERE o.orderID = ?
      `;
      db.query(sql, [id], (err, results) => {
        if (err) return res.status(500).json({ error: err });

        const doc = new PDFDocument();
        let buffers = [];

        doc.on("data", buffers.push.bind(buffers));
        doc.on("end", () => {
          const pdfBuffer = Buffer.concat(buffers);
          transporter.sendMail({
            from: '"My Shop" <noreply@myshop.com>',
            to: email,
            subject: `Order Delivered - Order #${id}`,
            text: `Your order has been marked as delivered. Thank you!`,
            attachments: [{ filename: `delivery-receipt-${id}.pdf`, content: pdfBuffer }]
          }, (err) => {
            if (err) return res.status(500).json({ error: err });
            res.json({ message: "Order marked as delivered. Email with receipt sent." });
          });
        });

        doc.fontSize(18).text(`Delivery Receipt - Order #${id}`, { underline: true });
        doc.moveDown();
        doc.fontSize(12).text(`Payment Method: ${results[0].paymentMethod}`);
        doc.text(`Shipping Address: ${results[0].shippingAddress}`);
        doc.moveDown().text("Delivered Items:");

        let total = 0;
        results.forEach(row => {
          const subtotal = row.priceAtPurchase * row.quantity;
          total += subtotal;
          doc.text(`- ${row.name} x${row.quantity} @ ₱${row.priceAtPurchase.toFixed(2)} = ₱${subtotal.toFixed(2)}`);
        });
        doc.moveDown().text(`Total: ₱${total.toFixed(2)}`);
        doc.end();
      });
    } else {
      transporter.sendMail({
        from: '"My Shop" <noreply@myshop.com>',
        to: email,
        subject: `Order ${status.toUpperCase()}`,
        text: `Your order #${id} has been ${status}.`
      }, (err) => {
        if (err) return res.status(500).json({ error: err });
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
    WHERE o.orderID = ?
  `;
  db.query(sql, [orderID], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (results.length === 0) return res.status(404).json({ message: "Order not found." });

    const order = {
      orderID: results[0].orderID,
      status: results[0].status,
      shippingAddress: results[0].shippingAddress,
      items: results.map(row => ({
        productID: row.productID,
        name: row.name,
        quantity: row.quantity,
        priceAtPurchase: row.priceAtPurchase
      }))
    };

    res.json(order);
  });
});

module.exports = router;