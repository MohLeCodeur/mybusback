// backend/routes/chauffeur.routes.js
const express = require("express");
const router = express.Router();
const {
  createChauffeur,
  getChauffeurs,
  getChauffeurById,
  updateChauffeur,
  deleteChauffeur,
} = require("../controllers/chauffeur.controller");

// LIGNE CORRIGÉE :
const { protect, isAdmin } = require("../middlewares/auth.middleware");

// Protéger toutes les routes de ce fichier
router.use(protect, isAdmin);

router.post("/", createChauffeur);
router.get("/", getChauffeurs);
router.get("/:id", getChauffeurById);
router.put("/:id", updateChauffeur);
router.delete("/:id", deleteChauffeur);

module.exports = router;