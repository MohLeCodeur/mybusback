const express = require('express');
const router = express.Router();
// --- DÉBUT DE LA CORRECTION ---
const { 
  createTrajet, 
  getAllTrajetsAdmin, 
  updateTrajet, 
  deleteTrajet,
  getAvailableTrajetsForColis,
  cancelTrajet // <-- 1. Importer la fonction d'annulation
} = require('../../controllers/trajet.controller');
// --- FIN DE LA CORRECTION ---
const { protect, isAdmin } = require('../../middlewares/auth.middleware');

router.use(protect, isAdmin);

router.get('/available-for-colis', getAvailableTrajetsForColis);

router.route('/')
  .post(createTrajet)
  .get(getAllTrajetsAdmin);

// --- DÉBUT DE LA CORRECTION ---
// 2. Ajouter la route spécifique pour l'annulation AVANT la route générique /:id
// C'est une bonne pratique de mettre les routes les plus spécifiques en premier.
router.put('/:id/cancel', cancelTrajet); 
// --- FIN DE LA CORRECTION ---

router.route('/:id')
  .put(updateTrajet)
  .delete(deleteTrajet);

module.exports = router;