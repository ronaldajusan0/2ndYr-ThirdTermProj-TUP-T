const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const db = require("../config/db");


// Routes
router.post("/products", upload.array("images"), productController.createProduct);
router.get("/products", productController.getProducts);
router.post("/products/:id", upload.array("images"), productController.updateProduct);
router.delete("/products/:id", productController.deleteProduct);


router.get("/products/:id", (req, res) => {
  const { id } = req.params;
  db.query(
    "SELECT * FROM products LEFT JOIN product_images ON products.productID = product_images.productID WHERE products.productID = ?",
    [id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err });
      if (!results.length) return res.status(404).json({ message: "Product not found" });

      const product = {
        ...results[0],
        images: results.map(row => ({
          filename: row.filename,
          isMain: row.isMain
        }))
      };

      res.json(product);
    }
  );
});

module.exports = router;
