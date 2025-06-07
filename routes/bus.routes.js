// backend/routes/bus.routes.js
const express = require("express");
const router = express.Router();
const {
  createBus,
  getBuses,
  getBusById,
  updateBus,
  deleteBus,
} = require("../controllers/bus.controller");

// LIGNE CORRIGÉE :
const { protect, isAdmin } = require("../middlewares/auth.middleware");

// Protéger toutes les routes de ce fichier
router.use(protect, isAdmin);

router.post("/", createBus);
router.get("/", getBuses);
router.get("/:id", getBusById);
router.put("/:id", updateBus);
router.delete("/:id", deleteBus);

module.exports = router;