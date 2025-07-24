const db = require("../config/db");
const path = require("path");
const fs = require("fs");

// CREATE
exports.createProduct = (req, res) => {
  console.log("FILES:", req.files); // Debugging
  const { name, brand, price, ram, storage, availability, quantity, mainPhoto, description } = req.body;

  const isAvailable = Number(availability) === 1 ? 1 : 0;
  const sql = `INSERT INTO products (name, brand, price, ram, storage, availability, quantity, description)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

  db.query(sql, [name, brand, price, ram, storage, isAvailable, quantity, description], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    const productId = result.insertId;

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

// READ all products
exports.getProducts = (req, res) => {
  const sql = `
    SELECT p.*, pi.imageID, pi.filename, pi.isMain
    FROM products p
    LEFT JOIN product_images pi ON p.productID = pi.productID
    ORDER BY p.productID, pi.isMain DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err });

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

    products.forEach(p => {
      delete p.filename;
      delete p.isMain;
      delete p.imageID;
    });

    res.json(products);
  });
};

// READ single product by ID with images
exports.getProductByID = (req, res) => {
  const productID = req.params.id;
  const sql = `
    SELECT p.*, pi.filename, pi.isMain
    FROM products p
    LEFT JOIN product_images pi ON p.productID = pi.productID
    WHERE p.productID = ?
  `;

  db.query(sql, [productID], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (results.length === 0) return res.status(404).json({ message: "Product not found" });

    const product = {
      ...results[0],
      images: results.filter(row => row.filename).map(row => ({
        filename: row.filename,
        isMain: row.isMain
      }))
    };

    delete product.filename;
    delete product.isMain;

    res.json(product);
  });
};

// UPDATE
exports.updateProduct = (req, res) => {
  const { id } = req.params;
  const { name, brand, price, ram, storage, availability, quantity, mainPhoto, description } = req.body;
  const isAvailable = Number(availability) === 1 ? 1 : 0;

  const sql = `UPDATE products SET name=?, brand=?, price=?, ram=?, storage=?, availability=?, quantity=?, description=? WHERE productID=?`;
  db.query(sql, [name, brand, price, ram, storage, isAvailable, quantity, description, id], (err, result) => {
    if (err) {
      console.error("Product update error:", err);
      return res.status(500).json({ error: err });
    }

    if (req.files && req.files.length > 0) {
      db.query("DELETE FROM product_images WHERE productID=?", [id], (delErr) => {
        if (delErr) {
          console.error("Image delete error:", delErr);
          return res.status(500).json({ error: delErr });
        }

        req.files.forEach((file, idx) => {
          const isMain = (idx + 1) === Number(mainPhoto) ? 1 : 0;
          db.query(
            "INSERT INTO product_images (productID, filename, isMain) VALUES (?, ?, ?)",
            [id, file.filename, isMain],
            (imgErr) => {
              if (imgErr) console.error("Image insert error:", imgErr);
            }
          );
        });
      });
    }

    res.json({ message: "Product updated" });
  });
};

// DELETE
exports.deleteProduct = (req, res) => {
  const { id } = req.params;

  const getImagesQuery = "SELECT filename FROM product_images WHERE productID = ?";
  db.query(getImagesQuery, [id], (imgErr, images) => {
    if (imgErr) {
      console.error("Error fetching image filenames:", imgErr);
      return res.status(500).json({ error: imgErr });
    }

    // Delete image files from filesystem
    images.forEach((img) => {
      const filePath = path.join(__dirname, "../uploads", img.filename);
      fs.unlink(filePath, (err) => {
        if (err) console.warn("⚠️ File not found or can't be deleted:", filePath);
      });
    });

    // Delete image records from database
    db.query("DELETE FROM product_images WHERE productID=?", [id], (delImgErr) => {
      if (delImgErr) {
        console.error("Error deleting product images:", delImgErr);
        return res.status(500).json({ error: delImgErr });
      }

      // Finally, delete the product itself
      db.query("DELETE FROM products WHERE productID=?", [id], (prodErr) => {
        if (prodErr) {
          console.error("Error deleting product:", prodErr);
          return res.status(500).json({ error: prodErr });
        }

        res.json({ message: "✅ Product and its images deleted successfully." });
      });
    });
  });
};
