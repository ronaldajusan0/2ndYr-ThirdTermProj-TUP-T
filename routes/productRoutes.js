const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const db = require("../config/db");
const { isAuthenticated, isAdmin, isAdminStrict } = require("../middlewares/auth");

// ✅ Public routes (anyone can view products)
// ⚠️ IMPORTANT: Search route must come BEFORE the generic /:id route
router.get("/products/search/:query", (req, res) => {
  const { query } = req.params;
  const searchTerm = `%${query}%`;
  
  const sql = `
    SELECT DISTINCT p.productID, p.name, p.brand, p.price, p.ram, p.storage, p.availability,
           pi.filename, pi.isMain
    FROM products p
    LEFT JOIN product_images pi ON p.productID = pi.productID
    WHERE (p.name LIKE ? OR p.brand LIKE ? OR p.ram LIKE ? OR p.storage LIKE ? OR p.description LIKE ?)
    ORDER BY 
      CASE 
        WHEN p.name LIKE ? THEN 1
        WHEN p.brand LIKE ? THEN 2
        ELSE 3
      END,
      p.name
    LIMIT 10
  `;
  
  db.query(sql, [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm], (err, results) => {
    if (err) return res.status(500).json({ success: false, error: err });
    
    // Group images by product for search results
    const products = [];
    const map = {};
    
    results.forEach(row => {
      if (!map[row.productID]) {
        map[row.productID] = {
          productID: row.productID,
          name: row.name,
          brand: row.brand,
          price: row.price,
          ram: row.ram,
          storage: row.storage,
          availability: row.availability,
          images: []
        };
        products.push(map[row.productID]);
      }
      
      if (row.filename) {
        map[row.productID].images.push({
          filename: row.filename,
          isMain: row.isMain
        });
      }
    });
    
    res.json({ success: true, products });
  });
});

router.get("/products", productController.getProducts);

// ✅ Paginated products endpoint with search and filters
router.get("/products/paginated", (req, res) => {
  const {
    page = 1,
    limit = 12,
    search = '',
    minPrice = '',
    maxPrice = '',
    brand = '',
    availability = ''
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  let whereClause = 'WHERE 1=1';
  let params = [];
  let countParams = [];

  // Build WHERE clause based on filters
  if (search) {
    whereClause += ' AND (p.name LIKE ? OR p.brand LIKE ? OR p.description LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
    countParams.push(searchTerm, searchTerm, searchTerm);
  }

  if (minPrice) {
    whereClause += ' AND p.price >= ?';
    params.push(parseFloat(minPrice));
    countParams.push(parseFloat(minPrice));
  }

  if (maxPrice) {
    whereClause += ' AND p.price <= ?';
    params.push(parseFloat(maxPrice));
    countParams.push(parseFloat(maxPrice));
  }

  if (brand) {
    whereClause += ' AND p.brand = ?';
    params.push(brand);
    countParams.push(brand);
  }

  if (availability !== '') {
    whereClause += ' AND p.availability = ?';
    params.push(parseInt(availability));
    countParams.push(parseInt(availability));
  }

  // Get total count
  const countSql = `
    SELECT COUNT(DISTINCT p.productID) as total
    FROM products p
    ${whereClause}
  `;

  db.query(countSql, countParams, (err, countResult) => {
    if (err) return res.status(500).json({ success: false, error: err });

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / parseInt(limit));

    // Get paginated products
    const sql = `
      SELECT p.productID, p.name, p.brand, p.price, p.description, p.quantity, p.availability,
             GROUP_CONCAT(pi.filename) as image
      FROM products p
      LEFT JOIN product_images pi ON p.productID = pi.productID
      ${whereClause}
      GROUP BY p.productID
      ORDER BY p.productID DESC
      LIMIT ? OFFSET ?
    `;

    params.push(parseInt(limit), offset);

    db.query(sql, params, (err, results) => {
      if (err) return res.status(500).json({ success: false, error: err });

      res.json({
        success: true,
        products: results,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          totalPages: totalPages,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1
        },
        total,
        totalPages
      });
    });
  });
});

router.get("/products/:id", (req, res) => {
  const { id } = req.params;
  db.query(
    "SELECT * FROM products LEFT JOIN product_images ON products.productID = product_images.productID WHERE products.productID = ?",
    [id],
    (err, results) => {
      if (err) return res.status(500).json({ success: false, error: err });
      if (!results.length) return res.status(404).json({ success: false, message: "Product not found" });

      const product = {
        ...results[0],
        images: results.map(row => ({
          filename: row.filename,
          isMain: row.isMain
        }))
      };

      res.json({ success: true, product });
    }
  );
});

// ✅ Protected routes (Admin-only CRUD operations with strict validation)
router.post("/products", isAdminStrict, upload.array("images"), productController.createProduct);
router.post("/products/:id", isAdminStrict, upload.array("images"), productController.updateProduct);
router.delete("/products/:id", isAdminStrict, productController.deleteProduct);

module.exports = router;
