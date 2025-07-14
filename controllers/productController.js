const db = require("../config/db");
const path = require("path");


exports.createProduct = (req, res) => {
  console.log("FILES:", req.files); // Add this for debugging
  const { name, brand, price, ram, storage, availability, quantity, mainPhoto } = req.body;
  // Save product first
  const isAvailable = Number(availability) === 1 ? 1 : 0;
  const sql = `INSERT INTO products (name, brand, price, ram, storage, availability, quantity)
               VALUES (?, ?, ?, ?, ?, ?, ?)`;
  db.query(sql, [name, brand, price, ram, storage, isAvailable, quantity], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    const productId = result.insertId;
    // Save imagesname
    if (req.files && req.files.length > 0) {
      req.files.forEach((file, idx) => {
        const isMain = (idx + 1) === Number(mainPhoto) ? 1 : 0;
        db.query(
          "INSERT INTO product_images (productID, filename, isMain) VALUES (?, ?, ?)",
          [productId, file.filename, isMain]
        );
      });
    }
    res.status(201).json({ message: "Product created", productId });
  });
};


// READ
exports.getProducts = (req, res) => {
  const sql = `
    SELECT p.*, pi.imageID, pi.filename, pi.isMain
    FROM products p
    LEFT JOIN product_images pi ON p.productID = pi.productID
    ORDER BY p.productID, pi.isMain DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err });

    // Group images by product
    const products = [];
    const map = {};
    results.forEach(row => {
      if (!map[row.productID]) {
        map[row.productID] = {
          ...row,
          images: [],
        };
        products.push(map[row.productID]);
      }
      if (row.filename) {
        map[row.productID].images.push({
          filename: row.filename,
          isMain: row.isMain,
        });
      }
    });

    // Remove duplicate fields
    products.forEach(p => {
      delete p.filename;
      delete p.isMain;
      delete p.imageID;
    });

    res.json(products);
  });
};

// UPDATE
exports.updateProduct = (req, res) => {
  const { id } = req.params;
  const { name, brand, price, ram, storage, availability, quantity, mainPhoto } = req.body;
  const isAvailable = Number(availability) === 1 ? 1 : 0;
  const sql = `UPDATE products SET name=?, brand=?, price=?, ram=?, storage=?, availability=?, quantity=? WHERE productID=?`;
  db.query(sql, [name, brand, price, ram, storage, isAvailable, quantity, id], (err, result) => {
    if (err) {
      console.error("Product update error:", err); // Add this line
      return res.status(500).json({ error: err });
    }

    // If new images uploaded, update product_images table
    if (req.files && req.files.length > 0) {
      db.query("DELETE FROM product_images WHERE productID=?", [id], (delErr) => {
        if (delErr) {
          console.error("Image delete error:", delErr); // Add this line
          return res.status(500).json({ error: delErr });
        }
        req.files.forEach((file, idx) => {
          const isMain = (idx + 1) === Number(mainPhoto) ? 1 : 0;
          db.query(
            "INSERT INTO product_images (productID, filename, isMain) VALUES (?, ?, ?)",
            [id, file.filename, isMain],
            (imgErr) => {
              if (imgErr) console.error("Image insert error:", imgErr); // Add this line
            }
          );
        });
      });
    }

    res.json({ message: "Product updated" });
  });
};


// DELETE
const fs = require("fs");

exports.deleteProduct = (req, res) => {
  const { id } = req.params;

  // Step 1: Get image filenames to delete from disk
  const getImagesQuery = "SELECT filename FROM product_images WHERE productID = ?";
  db.query(getImagesQuery, [id], (imgErr, images) => {
    if (imgErr) return res.status(500).json({ error: imgErr });

    // Step 2: Delete image files from disk
    images.forEach((img) => {
      const filePath = path.join(__dirname, "../uploads", img.filename);
      fs.unlink(filePath, (err) => {
        if (err) console.warn("⚠️ File not found or can't be deleted:", filePath);
      });
    });

    // Step 3: Delete image entries from DB
    db.query("DELETE FROM product_images WHERE productID=?", [id], (delImgErr) => {
      if (delImgErr) return res.status(500).json({ error: delImgErr });

      // Step 4: Delete product entry
      db.query("DELETE FROM products WHERE productID=?", [id], (prodErr) => {
        if (prodErr) return res.status(500).json({ error: prodErr });

        res.json({ message: "Product and images deleted successfully." });
      });
    });
  });
};

