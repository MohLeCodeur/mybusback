// backend/controllers/dashboard.controller.js
const mongoose = require('mongoose');
const axios = require('axios');
const Reservation = require('../models/reservation.model');
const LiveTrip = require('../models/LiveTrip.model');
const Colis = require('../models/colis.model');
const Trajet = require('../models/trajet.model');

/**
 * @desc    Fonction utilitaire pour calculer l'itinéraire via OpenRouteService
 * @param   {object} startCoords - Coordonnées de départ { lat, lng }
 * @param   {object} endCoords - Coordonnées d'arrivée { lat, lng }
 * @returns {object} Les données de l'itinéraire
 */
async function calculateORS_Route(startCoords, endCoords) {
    const ORS_API_KEY = process.env.ORS_API_KEY;
    if (!ORS_API_KEY) {
        throw new Error("Clé API OpenRouteService (ORS_API_KEY) non configurée.");
    }
    const url = 'https://api.openrouteservice.org/v2/directions/driving-hgv/geojson';
    const payload = {
        coordinates: [ [startCoords.lng, startCoords.lat], [endCoords.lng, endCoords.lat] ],
        instructions: true,
        instructions_format: "html"
    };
    const response = await axios.post(url, payload, {
        headers: { 'Authorization': ORS_API_KEY, 'Content-Type': 'application/json' }
    });
    const feature = response.data.features[0];
    if (!feature) throw new Error("Aucun itinéraire n'a pu être calculé.");
    return {
        geojson: feature.geometry,
        instructions: feature.properties.segments[0].steps.map(s => ({ instruction: s.instruction })),
        summary: {
            distanceKm: (feature.properties.summary.distance / 1000).toFixed(2),
            durationMin: Math.round(feature.properties.summary.duration / 60)
        }
    };
}

/**
 * @desc    Récupérer toutes les données pour le dashboard client
 * @route   GET /api/dashboard/client-data
 * @access  Privé (client connecté)
 */
exports.getClientDashboardData = async (req, res) => {
    try {
        const now = new Date();
        const clientId = req.user._id;

        // 1. Récupérer toutes les réservations confirmées, triées par date de départ
        const allReservations = await Reservation.find({ client: clientId, statut: 'confirmée' })
            .populate({ path: 'trajet', populate: { path: 'bus', select: 'numero' } })
            .sort({ 'trajet.dateDepart': 1 }); // Tri du plus proche au plus lointain

        let tripToDisplay = null;
        const upcomingTrips = []; // Liste de TOUS les voyages futurs
        const pastTrips = [];     // Liste de TOUS les voyages passés

        // 2. Classer chaque réservation
        for (const r of allReservations) {
            if (!r.trajet) continue;
            
            // On utilise la date et l'heure pour une précision maximale
            const departureDateTime = new Date(`${new Date(r.trajet.dateDepart).toISOString().split('T')[0]}T${r.trajet.heureDepart}:00Z`);
            
            // Fenêtre de suivi : un voyage est considéré "en cours" jusqu'à 12h après son départ
            const trackingWindowEnd = new Date(departureDateTime.getTime() + (12 * 60 * 60 * 1000));
            
            if (now < departureDateTime) {
                // Si le départ est dans le futur
                upcomingTrips.push(r);
            } else if (now >= departureDateTime && now <= trackingWindowEnd) {
                // Si nous sommes dans la fenêtre de suivi (le voyage est "en cours" ou "récent")
                // On le met en avant et aussi dans la liste des voyages passés pour l'historique
                if (!tripToDisplay) { // On ne met en avant que le premier trouvé
                    tripToDisplay = r;
                }
                pastTrips.push(r);
            } else {
                // Si le voyage est terminé depuis longtemps
                pastTrips.push(r);
            }
        }
        
        // 3. Le voyage "à la une" est celui en cours/récent, sinon le tout premier de la liste à venir.
        if (!tripToDisplay && upcomingTrips.length > 0) {
            tripToDisplay = upcomingTrips.shift(); // On le prend de la liste et on le retire pour ne pas l'afficher deux fois
        }
        
        // 4. Logique de récupération du LiveTrip (reste inchangée)
        let liveTripData = null;
        if (tripToDisplay) {
            const trajet = await Trajet.findById(tripToDisplay.trajet._id).lean();
            // ... (la logique pour créer/mettre à jour le LiveTrip reste la même que dans votre code original)
            // Pour la concision, je ne la recopie pas, mais elle doit rester.
            liveTripData = await LiveTrip.findOne({ trajetId: tripToDisplay.trajet._id });
        }

        // 5. Récupérer les 5 derniers colis de l'utilisateur (inchangé)
        const userColis = await Colis.find({ expediteur_email: req.user.email }).sort({ date_enregistrement: -1 }).limit(5);

        // 6. Renvoyer toutes les données au frontend
        res.json({
            tripToDisplay: tripToDisplay ? { reservation: tripToDisplay, liveTrip: liveTripData } : null,
            upcomingTrips, // Nouvelle liste des autres voyages à venir
            pastTrips: pastTrips.reverse(), // On inverse pour avoir les plus récents en premier
            colis: userColis,
        });

    } catch (err) {
        console.error("Erreur getClientDashboardData:", err);
        res.status(500).json({ message: err.message });
    }
};