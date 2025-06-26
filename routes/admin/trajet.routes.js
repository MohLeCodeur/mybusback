// backend/routes/admin/trajet.routes.js
const express = require('express');
const router = express.Router();
const { 
    createTrajet, 
    getAllTrajetsAdmin, 
    updateTrajet, 
    deleteTrajet,
    // --- NOUVEAUX IMPORTS ---
    demarrerTrajet,
    terminerTrajet,
    notifierRetard
} = require('../../controllers/trajet.controller');
const { protect, isAdmin } = require('../../middlewares/auth.middleware');

router.use(protect, isAdmin);

router.route('/')
  .post(createTrajet)
  .get(getAllTrajetsAdmin);

router.route('/:id')
  .put(updateTrajet)
  .delete(deleteTrajet);

// ==========================================================
// === NOUVELLES ROUTES POUR LES ACTIONS MANUELLES
// ==========================================================
router.post('/:id/demarrer', demarrerTrajet);
router.post('/:id/terminer', terminerTrajet);
router.post('/:id/notifier-retard', notifierRetard);
// ==========================================================

module.exports = router;