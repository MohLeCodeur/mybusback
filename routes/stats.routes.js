// backend/routes/stats.routes.js
const express = require("express");
const router = express.Router();
const { getRevenus } = require("../controllers/stats.controller");

// LIGNE CORRIGÉE :
const { protect, isAdmin } = require("../middlewares/auth.middleware");

// Protéger toutes les routes de ce fichier
router.use(protect, isAdmin);

router.get("/revenus", getRevenus);

module.exports = router;