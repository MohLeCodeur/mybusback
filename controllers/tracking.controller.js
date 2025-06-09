// backend/controllers/tracking.controller.js
const mongoose = require('mongoose');
const axios = require('axios');
const Reservation = require('../models/reservation.model');
const LiveTrip = require('../models/LiveTrip.model');
const Trajet = require('../models/trajet.model');

/**
 * @desc    Fonction utilitaire pour calculer l'itinéraire via OpenRouteService
 * @param   {object} startCoords - Coordonnées de départ { lat, lng }
 * @param   {object} endCoords - Coordonnées d'arrivée { lat, lng }
 * @returns {object} Les données de l'itinéraire (geojson, instructions, résumé)
 */
async function calculateORS_Route(startCoords, endCoords) {
    const ORS_API_KEY = process.env.ORS_API_KEY;
    if (!ORS_API_KEY) {
        throw new Error("Clé API OpenRouteService (ORS_API_KEY) non configurée dans le fichier .env");
    }

    const url = 'https://api.openrouteservice.org/v2/directions/driving-hgv/geojson';
    const payload = {
        coordinates: [ [startCoords.lng, startCoords.lat], [endCoords.lng, endCoords.lat] ],
        instructions: true,
        instructions_format: "html" // Format des instructions de navigation
    };

    const response = await axios.post(url, payload, {
        headers: { 'Authorization': ORS_API_KEY, 'Content-Type': 'application/json' }
    });
    
    const feature = response.data.features[0];
    if (!feature) {
        throw new Error("Aucun itinéraire n'a pu être calculé par OpenRouteService.");
    }
    
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
 * @desc    Pour un admin, démarrer le suivi en direct d'un voyage.
 *          Calcule et sauvegarde l'itinéraire si c'est le premier démarrage.
 * @route   POST /api/tracking/start-trip
 * @access  Admin
 */
exports.startTrip = async (req, res) => {
    try {
        const { trajetId } = req.body;
        const trajet = await Trajet.findById(trajetId).populate('bus');

        if (!trajet) return res.status(404).json({ message: "Trajet non trouvé" });
        if (!trajet.bus) return res.status(400).json({ message: "Aucun bus n'est assigné à ce trajet." });
        if (!trajet.coordsDepart?.lat || !trajet.coordsArrivee?.lat) {
            return res.status(400).json({ message: "Les coordonnées GPS de départ et d'arrivée sont manquantes pour ce trajet." });
        }

        let liveTrip = await LiveTrip.findOne({ trajetId });

        if (!liveTrip) {
            // Si le LiveTrip n'existe pas, on le crée et on calcule l'itinéraire
            const routeData = await calculateORS_Route(trajet.coordsDepart, trajet.coordsArrivee);
            
            liveTrip = new LiveTrip({
                trajetId: trajet._id,
                busId: trajet.bus._id,
                originCityName: trajet.villeDepart,
                destinationCityName: trajet.villeArrivee,
                departureDateTime: trajet.dateDepart,
                status: 'En cours',
                routeGeoJSON: routeData.geojson,
                routeInstructions: routeData.instructions,
                routeSummary: routeData.summary,
                currentPosition: trajet.coordsDepart // La position initiale est le point de départ
            });
        } else {
            // S'il existe déjà, on met juste son statut à jour
            liveTrip.status = 'En cours';
        }
        
        liveTrip.lastUpdated = new Date();
        await liveTrip.save();
        
        res.status(200).json({ message: "Le voyage a démarré avec succès.", liveTrip });

    } catch (err) {
        console.error("Erreur startTrip:", err.response?.data || err.message);
        res.status(500).json({ message: err.response?.data?.error?.message || err.message || "Erreur interne du serveur." });
    }
};

/**
 * @desc    Mettre à jour la position GPS d'un bus pour un voyage en direct
 * @route   POST /api/tracking/live/:liveTripId/update-position
 * @access  Admin (ou un appareil GPS autorisé)
 */
exports.updateBusPosition = async (req, res) => {
    try {
        const { liveTripId } = req.params;
        const { lat, lng } = req.body;
        if (typeof lat !== 'number' || typeof lng !== 'number') {
            return res.status(400).json({ message: "Les coordonnées lat et lng sont requises." });
        }

        const liveTrip = await LiveTrip.findByIdAndUpdate(
            liveTripId,
            { currentPosition: { lat, lng }, lastUpdated: new Date() },
            { new: true }
        );

        if (!liveTrip) return res.status(404).json({ message: "Voyage en cours non trouvé." });
        
        res.status(200).json(liveTrip);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * @desc    Pour le client, récupère les informations de son prochain voyage confirmé
 * @route   GET /api/tracking/my-next-trip
 * @access  Privé (client connecté)
 */
exports.getMyNextTrip = async (req, res) => {
    try {
        const now = new Date();
        const allConfirmedReservations = await Reservation.find({ client: req.user._id, statut: 'confirmée' }).populate('trajet');
        if (!allConfirmedReservations.length) return res.json({ message: "Vous n'avez aucune réservation confirmée." });

        const futureReservations = allConfirmedReservations.filter(r => {
            if (!r.trajet) return false;
            const departureDateTime = new Date(`${new Date(r.trajet.dateDepart).toISOString().split('T')[0]}T${r.trajet.heureDepart}:00`);
            return departureDateTime >= now;
        });

        if (!futureReservations.length) return res.json({ message: "Vous n'avez aucun voyage à venir." });

        futureReservations.sort((a, b) => new Date(a.trajet.dateDepart) - new Date(b.trajet.dateDepart));
        const nextReservation = futureReservations[0];
        const liveTrip = await LiveTrip.findOne({ trajetId: nextReservation.trajet._id });

        res.json({ reservation: nextReservation, liveTrip: liveTrip || null });
    } catch (err) {
        console.error("Erreur getMyNextTrip:", err);
        res.status(500).json({ message: err.message });
    }
};

/**
 * @desc    Récupérer les détails d'un voyage en cours par son ID
 * @route   GET /api/tracking/live/:liveTripId
 * @access  Privé (client connecté)
 */
exports.getLiveTripById = async (req, res) => {
    try {
        const { liveTripId } = req.params;
        // On peuple les informations du bus et du trajet pour les afficher sur la carte
        const liveTrip = await LiveTrip.findById(liveTripId).populate('busId', 'numero').populate('trajetId');

        if (!liveTrip) return res.status(404).json({ message: "Voyage en direct non trouvé." });
        
        // La vérification de sécurité est importante
        const hasReservation = await Reservation.findOne({ client: req.user._id, trajet: liveTrip.trajetId, statut: 'confirmée' });
        if (!hasReservation && req.user.role !== 'admin') {
            return res.status(403).json({ message: "Accès non autorisé à ce suivi." });
        }

        res.json(liveTrip);
    } catch (err) {
        console.error("Erreur getLiveTripById:", err);
        res.status(500).json({ message: "Erreur serveur." });
    }
};