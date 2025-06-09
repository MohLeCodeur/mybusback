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
router.post('/calculate-route', protect, async (req, res) => {
    try {
        const { pointA, pointB } = req.body;
        if (!pointA || !pointB || !pointA.lat || !pointA.lng || !pointB.lat || !pointB.lng) {
            return res.status(400).json({ message: "Les coordonnées de départ et d'arrivée sont requises." });
        }

        const ORS_API_KEY = process.env.ORS_API_KEY;
        const ORS_API_URL = 'https://api.openrouteservice.org/v2/directions/driving-hgv/geojson';

        const payload = {
            coordinates: [ [pointA.lng, pointA.lat], [pointB.lng, pointB.lat] ],
            instructions: true,
            instructions_format: "html"
        };

        const response = await axios.post(ORS_API_URL, payload, {
            headers: { 'Authorization': ORS_API_KEY, 'Content-Type': 'application/json' }
        });

        const feature = response.data.features[0];
        const summary = feature.properties.summary;
        const steps = feature.properties.segments[0].steps;

        res.json({
            distanceKm: (summary.distance / 1000).toFixed(2),
            durationMin: Math.round(summary.duration / 60),
            geojson: feature.geometry, // On ne renvoie que la géométrie
            instructions: steps,
        });

    } catch (error) {
        console.error("Erreur ORS:", error.response?.data || error.message);
        res.status(500).json({ message: "Erreur lors du calcul de l'itinéraire." });
    }
});

module.exports = router;