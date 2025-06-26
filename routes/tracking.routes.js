// mybusback/routes/tracking.routes.js

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { protect, isAdmin } = require('../middlewares/auth.middleware');
const { 
    startTrip, 
    updateBusPosition, 
    getMyNextTrip,
    getLiveTripById,
    endTrip,          // <-- NOUVEAU
    notifyDelay       // <-- NOUVEAU
} = require('../controllers/tracking.controller');

// Routes pour les clients
router.get('/my-next-trip', protect, getMyNextTrip);
router.get('/live/:liveTripId', protect, getLiveTripById);

// ==========================================================
// === NOUVELLES ROUTES POUR LES ACTIONS ADMIN
// ==========================================================
router.post('/start-trip', protect, isAdmin, startTrip);
router.post('/end-trip/:liveTripId', protect, isAdmin, endTrip); // Pour terminer un voyage
router.post('/notify-delay', protect, isAdmin, notifyDelay);   // Pour notifier un retard
// ==========================================================

// Route pour mettre à jour la position GPS (généralement appelée par un appareil, mais protégée pour les admins)
router.post('/live/:liveTripId/update-position', protect, isAdmin, updateBusPosition);

// Route utilitaire pour calculer un itinéraire
router.post('/calculate-route', protect, async (req, res) => {
    try {
        const { pointA, pointB } = req.body;
        if (!pointA || !pointB || !pointA.lat || !pointA.lng || !pointB.lat || !pointB.lng) {
            return res.status(400).json({ message: "Coordonnées de départ et d'arrivée requises." });
        }

        const ORS_API_KEY = process.env.ORS_API_KEY;
        const ORS_API_URL = 'https://api.openrouteservice.org/v2/directions/driving-hgv/geojson';

        const payload = {
            coordinates: [ [pointA.lng, pointA.lat], [pointB.lng, pointB.lat] ],
            instructions: true, instructions_format: "html"
        };
        const response = await axios.post(ORS_API_URL, payload, {
            headers: { 'Authorization': ORS_API_KEY, 'Content-Type': 'application/json' }
        });

        const feature = response.data.features[0];
        res.json({
            distanceKm: (feature.properties.summary.distance / 1000).toFixed(2),
            durationMin: Math.round(feature.properties.summary.duration / 60),
            geojson: feature.geometry,
            instructions: feature.properties.segments[0].steps,
        });
    } catch (error) {
        console.error("Erreur ORS:", error.response?.data || error.message);
        res.status(500).json({ message: "Erreur lors du calcul de l'itinéraire." });
    }
});

module.exports = router;