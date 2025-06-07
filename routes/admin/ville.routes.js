// backend/routes/admin/ville.routes.js
const express = require('express');
const router = express.Router();
const { createVille, getVilles, updateVille, deleteVille, createTarif, getTarifs, updateTarif, deleteTarif } = require('../../controllers/ville.controller');
const { protect, isAdmin } = require('../../middlewares/auth.middleware');

router.use(protect, isAdmin);

// Routes pour les Villes
router.route('/villes')
  .post(createVille)
  .get(getVilles);

router.route('/villes/:id')
  .put(updateVille)
  .delete(deleteVille);

// Routes pour les Tarifs
router.route('/tarifs')
  .post(createTarif)
  .get(getTarifs);

router.route('/tarifs/:id')
  .put(updateTarif)
  .delete(deleteTarif);

module.exports = router;