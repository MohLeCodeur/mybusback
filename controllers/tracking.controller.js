// backend/controllers/tracking.controller.js
const mongoose = require('mongoose');
const axios = require('axios');
const Reservation = require('../models/reservation.model');
const LiveTrip = require('../models/LiveTrip.model');
const Trajet = require('../models/trajet.model');
const { getDistance } = require('geolib');
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
            return res.status(400).json({ message: "Les coordonnées GPS sont manquantes pour ce trajet." });
        }

        let liveTrip = await LiveTrip.findOne({ trajetId });

        if (!liveTrip) {
            const routeData = await calculateORS_Route(trajet.coordsDepart, trajet.coordsArrivee); // Assurez-vous que cette fonction est définie
            liveTrip = new LiveTrip({
                trajetId: trajet._id, busId: trajet.bus._id,
                originCityName: trajet.villeDepart, destinationCityName: trajet.villeArrivee,
                departureDateTime: trajet.dateDepart,
                routeGeoJSON: routeData.geojson,
                routeInstructions: routeData.instructions,
                routeSummary: routeData.summary,
                currentPosition: trajet.coordsDepart
            });
        }
        
        liveTrip.status = 'En cours';
        liveTrip.lastUpdated = new Date();
        await liveTrip.save();

        // --- SECTION D'ÉMISSION DE LA NOTIFICATION ---
        // 1. Trouver toutes les réservations pour ce trajet
        const reservations = await Reservation.find({ trajet: trajet._id, statut: 'confirmée' });

        // 2. Pour chaque réservation, trouver le client et lui envoyer une notification s'il est en ligne
        reservations.forEach(r => {
            const recipientUserId = r.client.toString();
            const recipientSocketId = req.onlineUsers[recipientUserId]; // req.onlineUsers vient du middleware

            if (recipientSocketId) {
                console.log(`Envoi de la notification de démarrage à l'utilisateur ${recipientUserId} sur le socket ${recipientSocketId}`);
                req.io.to(recipientSocketId).emit("getNotification", {
                    title: "Votre voyage a commencé !",
                    message: `Le suivi pour le trajet ${trajet.villeDepart} → ${trajet.villeArrivee} est maintenant actif.`,
                    link: `/tracking/map/${liveTrip._id}` // Lien direct vers la page de suivi
                });
            }
        });
        // ---------------------------------------------
        
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
        const clientId = req.user._id;

        // 1. Trouver la réservation confirmée la plus proche dans le futur
        const allReservations = await Reservation.find({ client: clientId, statut: 'confirmée' }).populate('trajet');
        
        const futureReservations = allReservations
            .filter(r => {
                if (!r.trajet) return false;
                const departureDateTime = new Date(`${new Date(r.trajet.dateDepart).toISOString().split('T')[0]}T${r.trajet.heureDepart}:00`);
                return departureDateTime >= now;
            })
            .sort((a, b) => new Date(a.trajet.dateDepart) - new Date(b.trajet.dateDepart));

        if (futureReservations.length > 0) {
            // Un voyage est encore à venir, on renvoie les infos avec le compte à rebours
            const nextReservation = futureReservations[0];
            const liveTrip = await LiveTrip.findOne({ trajetId: nextReservation.trajet._id });
            return res.json({ reservation: nextReservation, liveTrip: liveTrip || null });
        }
        
        // 2. Si aucun voyage futur, trouver le voyage le plus récent qui est parti
        const pastReservations = allReservations
            .filter(r => {
                if (!r.trajet) return false;
                const departureDateTime = new Date(`${new Date(r.trajet.dateDepart).toISOString().split('T')[0]}T${r.trajet.heureDepart}:00`);
                // On vérifie s'il est parti il y a moins de 12 heures (par exemple)
                const hoursSinceDeparture = (now - departureDateTime) / (1000 * 60 * 60);
                return hoursSinceDeparture >= 0 && hoursSinceDeparture < 12; 
            })
            .sort((a, b) => new Date(b.trajet.dateDepart) - new Date(a.trajet.dateDepart));
            
        if (pastReservations.length > 0) {
            // C'est le voyage en cours ou qui vient de partir !
            const currentReservation = pastReservations[0];
            const trajet = await Trajet.findById(currentReservation.trajet._id);

            if (!trajet.coordsDepart?.lat || !trajet.coordsArrivee?.lat) {
                return res.json({ reservation: currentReservation, liveTrip: null, message: "Suivi non disponible pour ce trajet (coordonnées manquantes)." });
            }

            // On cherche ou on crée le LiveTrip automatiquement
            let liveTrip = await LiveTrip.findOne({ trajetId: trajet._id });
            if (!liveTrip) {
                console.log(`Création automatique du LiveTrip pour le trajet ${trajet._id}`);
                const routeData = await calculateORS_Route(trajet.coordsDepart, trajet.coordsArrivee);
                liveTrip = new LiveTrip({
                    trajetId: trajet._id, busId: trajet.bus,
                    originCityName: trajet.villeDepart, destinationCityName: trajet.villeArrivee,
                    departureDateTime: trajet.dateDepart, status: 'En cours',
                    routeGeoJSON: routeData.geojson, routeInstructions: routeData.instructions,
                    routeSummary: routeData.summary, currentPosition: trajet.coordsDepart
                });
            } else if (liveTrip.status !== 'Terminé') {
                liveTrip.status = 'En cours';
            }
            
            liveTrip.lastUpdated = new Date();
            await liveTrip.save();

            return res.json({ reservation: currentReservation, liveTrip });
        }
        
        // Si aucun voyage futur ni récent n'est trouvé
        return res.json({ message: "Vous n'avez aucun voyage récent ou à venir." });

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
        const liveTrip = await LiveTrip.findById(liveTripId)
            .populate('busId', 'numero')
            .populate('trajetId'); // On peuple l'objet trajet entier

        if (!liveTrip) {
            return res.status(404).json({ message: "Voyage en direct non trouvé." });
        }

        // --- VÉRIFICATION DE SÉCURITÉ ROBUSTE ---
        // On s'assure que liveTrip.trajetId existe avant de l'utiliser
        if (!liveTrip.trajetId) {
             return res.status(404).json({ message: "Le trajet associé à ce suivi est introuvable." });
        }
        
        const hasReservation = await Reservation.findOne({
            client: req.user._id,
            trajet: liveTrip.trajetId._id, // On utilise bien l'ID
            statut: 'confirmée'
        });

        if (!hasReservation && req.user.role !== 'admin') {
            return res.status(403).json({ message: "Accès non autorisé à ce suivi." });
        }
        // ------------------------------------

        let tripData = liveTrip.toObject();
        let eta = null;

        // Calcul de la progression et de l'ETA
        if (tripData.currentPosition && tripData.trajetId?.coordsArrivee && tripData.routeSummary?.distanceKm) {
            const remainingDistanceMeters = getDistance(
                { latitude: tripData.currentPosition.lat, longitude: tripData.currentPosition.lng },
                { latitude: tripData.trajetId.coordsArrivee.lat, longitude: tripData.trajetId.coordsArrivee.lng }
            );
            const remainingDistanceKm = remainingDistanceMeters / 1000;
            const totalDistanceKm = parseFloat(tripData.routeSummary.distanceKm);
            const progressPercentage = Math.min(100, Math.max(0, ((totalDistanceKm - remainingDistanceKm) / totalDistanceKm) * 100));

            tripData.progress = {
                percentage: progressPercentage.toFixed(0),
                remainingKm: remainingDistanceKm.toFixed(1)
            };
            
            // Calcul ETA plus précis
            if (tripData.routeSummary.durationMin > 0) {
                const remainingDurationMin = tripData.routeSummary.durationMin * (remainingDistanceKm / totalDistanceKm);
                const arrivalTimestamp = new Date().getTime() + (remainingDurationMin * 60 * 1000);
                eta = new Date(arrivalTimestamp);
            }
        }
        
        tripData.eta = eta;
        
        res.json(tripData);

    } catch (err) {
        console.error("Erreur [getLiveTripById]:", err);
        res.status(500).json({ message: "Erreur serveur lors de la récupération du suivi." });
    }
};