// backend/controllers/tracking.controller.js
const mongoose = require('mongoose');
const axios = require('axios');
const Reservation = require('../models/reservation.model');
const LiveTrip = require('../models/LiveTrip.model');
const Trajet = require('../models/trajet.model');
const { getDistance } = require('geolib');

async function calculateORS_Route(startCoords, endCoords) {
    const ORS_API_KEY = process.env.ORS_API_KEY;
    if (!ORS_API_KEY) throw new Error("Clé API OpenRouteService (ORS_API_KEY) non configurée.");
    const url = 'https://api.openrouteservice.org/v2/directions/driving-hgv/geojson';
    const payload = {
        coordinates: [ [startCoords.lng, startCoords.lat], [endCoords.lng, endCoords.lat] ],
        instructions: true, instructions_format: "html"
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

exports.startTrip = async (req, res) => {
    try {
        const { trajetId } = req.body;
        const trajet = await Trajet.findById(trajetId).populate('bus');
        if (!trajet) return res.status(404).json({ message: "Trajet non trouvé" });
        if (!trajet.bus) return res.status(400).json({ message: "Aucun bus n'est assigné." });
        if (!trajet.coordsDepart?.lat || !trajet.coordsArrivee?.lat) return res.status(400).json({ message: "Coordonnées manquantes." });
        
        let liveTrip = await LiveTrip.findOne({ trajetId });

        if (!liveTrip) {
            const routeData = await calculateORS_Route(trajet.coordsDepart, trajet.coordsArrivee);
            liveTrip = new LiveTrip({
                trajetId: trajet._id, busId: trajet.bus._id,
                originCityName: trajet.villeDepart, destinationCityName: trajet.villeArrivee,
                departureDateTime: trajet.dateDepart, routeGeoJSON: routeData.geojson,
                routeInstructions: routeData.instructions, routeSummary: routeData.summary,
                currentPosition: trajet.coordsDepart
            });
        }
        
        liveTrip.status = 'En cours';
        liveTrip.lastUpdated = new Date();
        await liveTrip.save();
        
        // ==========================================================
        // === DÉBUT DE LA CORRECTION : NOTIFICATION ET MISE À JOUR D'ÉTAT
        // ==========================================================
        const reservations = await Reservation.find({ trajet: trajet._id, statut: 'confirmée' }).populate('client', '_id');
        reservations.forEach(r => {
            if (!r.client) return;
            const recipientSocketId = req.onlineUsers[r.client._id.toString()];
            if (recipientSocketId) {
                // 1. Envoyer la notification de démarrage
                req.io.to(recipientSocketId).emit("getNotification", {
                    title: "Votre voyage a commencé !",
                    message: `Le suivi pour ${trajet.villeDepart} → ${trajet.villeArrivee} est actif.`,
                    link: `/tracking/map/${liveTrip._id}`
                });
                // 2. Envoyer l'événement de mise à jour d'état pour forcer le rafraîchissement
                req.io.to(recipientSocketId).emit("tripStateChanged", { trajetId: trajet._id });
            }
        });
        // ==========================================================
        // === FIN DE LA CORRECTION
        // ==========================================================
        
        res.status(200).json({ message: "Le voyage a démarré avec succès.", liveTrip });
    } catch (err) {
        console.error("Erreur startTrip:", err.response?.data || err.message);
        res.status(500).json({ message: err.response?.data?.error?.message || err.message || "Erreur interne." });
    }
};

// ==========================================================
// === NOUVELLE FONCTION POUR TERMINER UN VOYAGE
// ==========================================================
/**
 * @desc    Pour un admin, terminer manuellement le suivi d'un voyage.
 * @route   POST /api/tracking/end-trip/:liveTripId
 * @access  Admin
 */
exports.endTrip = async (req, res) => {
    try {
        const { liveTripId } = req.params;
        const liveTrip = await LiveTrip.findById(liveTripId).populate('trajetId');
        if (!liveTrip) return res.status(404).json({ message: "Voyage en cours non trouvé." });
        
        liveTrip.status = 'Terminé';
        liveTrip.lastUpdated = new Date();
        if (liveTrip.trajetId && liveTrip.trajetId.coordsArrivee) {
            liveTrip.currentPosition = liveTrip.trajetId.coordsArrivee;
        }
        await liveTrip.save();

        // ==========================================================
        // === DÉBUT DE LA CORRECTION : NOTIFICATION ET MISE À JOUR D'ÉTAT
        // ==========================================================
        const reservations = await Reservation.find({ trajet: liveTrip.trajetId._id, statut: 'confirmée' }).populate('client', '_id');
        reservations.forEach(r => {
            if (!r.client) return;
            const recipientSocketId = req.onlineUsers[r.client._id.toString()];
            if (recipientSocketId) {
                req.io.to(recipientSocketId).emit("getNotification", {
                    title: "Votre voyage est terminé !",
                    message: `Le bus pour ${liveTrip.originCityName} → ${liveTrip.destinationCityName} est arrivé.`,
                    link: `/dashboard`
                });
                req.io.to(recipientSocketId).emit("tripStateChanged", { trajetId: liveTrip.trajetId._id });
            }
        });
        // ==========================================================
        // === FIN DE LA CORRECTION
        // ==========================================================

        res.status(200).json({ message: "Le voyage a été marqué comme terminé." });
    } catch (err) {
        console.error("Erreur endTrip:", err.message);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
};

// ==========================================================
// === NOUVELLE FONCTION POUR NOTIFIER UN RETARD
// ==========================================================
/**
 * @desc    Pour un admin, envoyer une notification de retard pour un trajet.
 * @route   POST /api/tracking/notify-delay
 * @access  Admin
 */
exports.notifyDelay = async (req, res) => {
    try {
        const { trajetId } = req.body;
        const trajet = await Trajet.findById(trajetId);
        if (!trajet) {
            return res.status(404).json({ message: "Trajet non trouvé." });
        }

        const reservations = await Reservation.find({ trajet: trajetId, statut: 'confirmée' }).populate('client', '_id');
        
        if (reservations.length === 0) {
            return res.status(200).json({ message: "Aucun passager à notifier pour ce trajet." });
        }

        let notificationCount = 0;
        reservations.forEach(r => {
            if (!r.client) return;
            const recipientSocketId = req.onlineUsers[r.client._id.toString()];
            if (recipientSocketId) {
                notificationCount++;
                req.io.to(recipientSocketId).emit("getNotification", {
                    title: "Information sur votre voyage",
                    message: `Le départ du trajet ${trajet.villeDepart} → ${trajet.villeArrivee} est retardé. Nous vous prions de patienter.`,
                    link: `/dashboard`
                });
            }
        });
        
        res.status(200).json({ message: `${notificationCount} passager(s) ont été notifié(s) du retard.` });

    } catch (err) {
        console.error("Erreur notifyDelay:", err.message);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
};

// --- Les autres fonctions restent inchangées ---

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

exports.getMyNextTrip = async (req, res) => {
    try {
        const now = new Date();
        const clientId = req.user._id;

        const allReservations = await Reservation.find({ client: clientId, statut: 'confirmée' }).populate('trajet');
        
        const futureReservations = allReservations
            .filter(r => {
                if (!r.trajet) return false;
                const departureDateTime = new Date(`${new Date(r.trajet.dateDepart).toISOString().split('T')[0]}T${r.trajet.heureDepart}:00`);
                return departureDateTime >= now;
            })
            .sort((a, b) => new Date(a.trajet.dateDepart) - new Date(b.trajet.dateDepart));

        if (futureReservations.length > 0) {
            const nextReservation = futureReservations[0];
            const liveTrip = await LiveTrip.findOne({ trajetId: nextReservation.trajet._id });
            return res.json({ reservation: nextReservation, liveTrip: liveTrip || null });
        }
        
        const pastReservations = allReservations
            .filter(r => {
                if (!r.trajet) return false;
                const departureDateTime = new Date(`${new Date(r.trajet.dateDepart).toISOString().split('T')[0]}T${r.trajet.heureDepart}:00`);
                const hoursSinceDeparture = (now - departureDateTime) / (1000 * 60 * 60);
                return hoursSinceDeparture >= 0 && hoursSinceDeparture < 12; 
            })
            .sort((a, b) => new Date(b.trajet.dateDepart) - new Date(a.trajet.dateDepart));
            
        if (pastReservations.length > 0) {
            const currentReservation = pastReservations[0];
            const trajet = await Trajet.findById(currentReservation.trajet._id);

            if (!trajet.coordsDepart?.lat || !trajet.coordsArrivee?.lat) {
                return res.json({ reservation: currentReservation, liveTrip: null, message: "Suivi non disponible." });
            }

            let liveTrip = await LiveTrip.findOne({ trajetId: trajet._id });
            if (!liveTrip) {
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
        
        return res.json({ message: "Vous n'avez aucun voyage récent ou à venir." });
    } catch (err) {
        console.error("Erreur getMyNextTrip:", err);
        res.status(500).json({ message: err.message });
    }
};

exports.getLiveTripById = async (req, res) => {
    try {
        const { liveTripId } = req.params;
        const liveTrip = await LiveTrip.findById(liveTripId)
            .populate('busId', 'numero')
            .populate('trajetId');

        if (!liveTrip) return res.status(404).json({ message: "Voyage non trouvé." });
        if (!liveTrip.trajetId) return res.status(404).json({ message: "Trajet associé introuvable." });
        
        const hasReservation = await Reservation.findOne({
            client: req.user._id,
            trajet: liveTrip.trajetId._id,
            statut: 'confirmée'
        });

        if (!hasReservation && req.user.role !== 'admin') {
            return res.status(403).json({ message: "Accès non autorisé." });
        }

        let tripData = liveTrip.toObject();
        let eta = null;

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
        res.status(500).json({ message: "Erreur serveur." });
    }
};