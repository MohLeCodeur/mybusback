// backend/routes/admin/trajet.routes.js
const express = require('express');
const router = express.Router();
// --- LIGNE MODIFIÉE : On importe cancelTrajet ---
const { createTrajet, getAllTrajetsAdmin, updateTrajet, deleteTrajet, cancelTrajet } = require('../../controllers/trajet.controller');
const { protect, isAdmin } = require('../../middlewares/auth.middleware');

router.use(protect, isAdmin);

router.route('/')
  .post(createTrajet)
  .get(getAllTrajetsAdmin);

router.route('/:id')
  .put(updateTrajet)
  .delete(deleteTrajet);
  
// --- NOUVELLE ROUTE ---
// Permet d'annuler un trajet spécifiquement
router.put('/:id/cancel', cancelTrajet);

module.exports = router;