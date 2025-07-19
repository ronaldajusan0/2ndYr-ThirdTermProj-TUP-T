const db = require("../config/db");

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

    return res.status(201).json({ success: true, orderID });
  } catch (err) {
    console.error("Order creation error:", err);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
