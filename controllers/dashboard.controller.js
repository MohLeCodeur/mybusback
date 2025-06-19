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
            .sort({ 'trajet.dateDepart': 1 }); // Trié du plus proche au plus lointain

        let nextTrip = null;
        let currentTrip = null;
        const pastTrips = [];

        // 2. Classer chaque réservation en trois catégories
        for (const r of allReservations) {
            if (!r.trajet) continue;
            
            const departureDateTime = new Date(`${new Date(r.trajet.dateDepart).toISOString().split('T')[0]}T${r.trajet.heureDepart}:00Z`);
            
            // La fenêtre de suivi dure 12 heures après le départ
            const trackingWindowEnd = new Date(departureDateTime.getTime() + (12 * 60 * 60 * 1000));
            
            if (departureDateTime > now) {
                // Si le départ est dans le futur
                if (!nextTrip) nextTrip = r;
            } else if (now >= departureDateTime && now <= trackingWindowEnd) {
                // Si nous sommes dans la fenêtre de suivi (départ passé mais il y a moins de 12h)
                if (!currentTrip) currentTrip = r;
            } else {
                // Si le voyage est terminé depuis longtemps
                pastTrips.push(r);
            }
        }
        
        // 3. Le voyage à afficher en priorité est celui en cours, sinon le prochain voyage à venir
        let tripToShow = currentTrip || nextTrip;
        let liveTripData = null;

        if (tripToShow) {
            const trajet = await Trajet.findById(tripToShow.trajet._id).lean();

            // Si le voyage à afficher est celui qui est en cours/récent, on crée/met à jour le LiveTrip
            if (tripToShow === currentTrip) {
                if(trajet?.coordsDepart?.lat) {
                    let liveTrip = await LiveTrip.findOne({ trajetId: trajet._id });
                    if (!liveTrip) {
                        console.log(`[AUTO] Création du LiveTrip pour le trajet ${trajet._id}`);
                        const routeData = await calculateORS_Route(trajet.coordsDepart, trajet.coordsArrivee);
                        liveTrip = new LiveTrip({
                            trajetId: trajet._id, busId: trajet.bus, status: 'En cours',
                            routeGeoJSON: routeData.geojson, routeInstructions: routeData.instructions,
                            routeSummary: routeData.summary, currentPosition: trajet.coordsDepart
                        });
                    } else if (liveTrip.status !== 'Terminé') {
                        liveTrip.status = 'En cours';
                    }
                    liveTrip.lastUpdated = new Date();
                    await liveTrip.save();
                    liveTripData = liveTrip;
                }
            } else {
                // Pour un voyage futur, on vérifie juste si un LiveTrip existe déjà (au cas où un admin l'a démarré en avance)
                liveTripData = await LiveTrip.findOne({ trajetId: tripToShow.trajet._id });
            }
        }

        // 4. Récupérer les 5 derniers colis de l'utilisateur
        const userColis = await Colis.find({ expediteur_email: req.user.email }).sort({ date_enregistrement: -1 }).limit(5);

        // 5. Renvoyer toutes les données au frontend
        res.json({
            tripToDisplay: tripToShow ? { reservation: tripToShow, liveTrip: liveTripData } : null,
            pastTrips: pastTrips.reverse(), // On inverse pour avoir les plus récents en premier
            colis: userColis,
            message: !tripToShow ? "Vous n'avez aucun voyage à venir ou récent." : null
        });

    } catch (err) {
        console.error("Erreur getClientDashboardData:", err);
        res.status(500).json({ message: err.message });
    }
};