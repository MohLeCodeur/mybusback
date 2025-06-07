// backend/routes/ville.routes.js
const express = require("express");
const router = express.Router();
const {
  createVille,
  getVilles,
  updateVille,
  deleteVille,
  createTarif,
  getTarifs,
  updateTarif,
  deleteTarif,
} = require("../controllers/ville.controller");

// LIGNE CORRIGÉE :
const { protect, isAdmin } = require("../middlewares/auth.middleware");

// Protéger toutes les routes de ce fichier
router.use(protect, isAdmin);

// Villes
router.post("/villes", createVille);
router.get("/villes", getVilles);
router.put("/villes/:id", updateVille);
router.delete("/villes/:id", deleteVille);

// Tarifs
router.post("/tarifs", createTarif);
router.get("/tarifs", getTarifs);
router.put("/tarifs/:id", updateTarif);
router.delete("/tarifs/:id", deleteTarif);

module.exports = router;