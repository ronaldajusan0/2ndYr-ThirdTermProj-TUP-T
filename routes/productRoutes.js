const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });

// Routes
router.post("/products", upload.array("images"), productController.createProduct);
router.get("/products", productController.getProducts);
router.post("/products/:id", upload.array("images"), productController.updateProduct);
router.delete("/products/:id", productController.deleteProduct);

module.exports = router;
