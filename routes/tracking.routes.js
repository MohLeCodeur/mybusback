// backend/routes/tracking.routes.js
const express = require('express');
const router = express.Router();
const { protect, isAdmin } = require('../middlewares/auth.middleware');
const { 
    startTrip, 
    updateBusPosition, 
    getMyNextTrip,
    getLiveTripById // <-- Importer la nouvelle fonction
} = require('../controllers/tracking.controller');

// Route pour qu'un client récupère son prochain voyage (protégée par login)
router.get('/my-next-trip', protect, getMyNextTrip);

// --- NOUVELLE ROUTE ---
// Route pour récupérer les détails d'un voyage en direct par son ID
router.get('/live/:liveTripId', protect, getLiveTripById);
// --------------------

// Route pour qu'un admin démarre un voyage
router.post('/start-trip', protect, isAdmin, startTrip);

// Route pour mettre à jour la position d'un bus
router.post('/live/:liveTripId/update-position', protect, isAdmin, updateBusPosition);

module.exports = router;