// backend/routes/colis.routes.js
const express = require("express");
const router = express.Router();
const {
  creerColis,
  getAllColis,
  getColisById,
  getColisByCode,
  updateStatutColis,
  updateColis,
} = require("../controllers/colis.controller");

// LIGNE CORRIGÉE :
const { protect, isAdmin } = require("../middlewares/auth.middleware");

// --- Route publique pour le suivi ---
router.get("/track/:code", getColisByCode);

// --- Routes Admin (protégées) ---
router.post("/", protect, isAdmin, creerColis);
router.get("/", protect, isAdmin, getAllColis);
router.get("/:id", protect, isAdmin, getColisById);
router.put("/:id/statut", protect, isAdmin, updateStatutColis);
router.put("/:id", protect, isAdmin, updateColis);

module.exports = router;