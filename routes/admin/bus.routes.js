// backend/routes/admin/bus.routes.js
const express = require('express');
const router = express.Router();
// --- CORRECTION : Importer la nouvelle fonction ---
const { createBus, getBuses, getBusById, updateBus, deleteBus, getAvailableBuses } = require('../../controllers/bus.controller');
const { protect, isAdmin } = require('../../middlewares/auth.middleware');

// Protège toutes les routes de ce fichier
router.use(protect, isAdmin);

// --- CORRECTION : Ajouter la nouvelle route ---
router.get('/available', getAvailableBuses);
// ------------------------------------------

// Route principale pour la liste paginée
router.route('/')
  .post(createBus)
  .get(getBuses);

// Routes pour un bus spécifique
router.route('/:id')
  .get(getBusById)
  .put(updateBus)
  .delete(deleteBus);

module.exports = router;