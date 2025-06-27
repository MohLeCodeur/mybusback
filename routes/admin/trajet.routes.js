// backend/routes/admin/trajet.routes.js
const express = require('express');
const router = express.Router();
// --- DÉBUT DE LA CORRECTION : Importer la nouvelle fonction ---
const { 
  createTrajet, 
  getAllTrajetsAdmin, 
  updateTrajet, 
  deleteTrajet,
  getAvailableTrajetsForColis // <-- NOUVELLE FONCTION
} = require('../../controllers/trajet.controller');
// --- FIN DE LA CORRECTION ---
const { protect, isAdmin } = require('../../middlewares/auth.middleware');

router.use(protect, isAdmin);

// --- DÉBUT DE LA CORRECTION : Ajouter la nouvelle route ---
// Cette route est spécifique pour les formulaires admin et n'est pas paginée
router.get('/available-for-colis', getAvailableTrajetsForColis);
// --- FIN DE LA CORRECTION ---

router.route('/')
  .post(createTrajet)
  .get(getAllTrajetsAdmin);

router.route('/:id')
  .put(updateTrajet)
  .delete(deleteTrajet);

module.exports = router;