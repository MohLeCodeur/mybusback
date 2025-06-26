// backend/controllers/dashboard.controller.js
const mongoose = require('mongoose');
const Reservation = require('../models/reservation.model');
const Colis = require('../models/colis.model');

// La fonction utilitaire `calculateORS_Route` reste inchangée.

exports.getClientDashboardData = async (req, res) => {
    try {
        const now = new Date();
        const clientId = req.user._id;

        // L'agrégation pour récupérer toutes les données reste la même, elle est très efficace.
        const allReservations = await Reservation.aggregate([
            { $match: { client: new mongoose.Types.ObjectId(clientId), statut: 'confirmée' } },
            { $lookup: { from: 'trajets', localField: 'trajet', foreignField: '_id', as: 'trajet' }},
            { $unwind: '$trajet' },
            { $lookup: { from: 'livetrips', localField: 'trajet._id', foreignField: 'trajetId', as: 'liveTrip' }},
            { $addFields: { liveTrip: { $arrayElemAt: ['$liveTrip', 0] } }},
            { $lookup: { from: 'bus', localField: 'trajet.bus', foreignField: '_id', as: 'trajet.bus' }},
            { $unwind: { path: '$trajet.bus', preserveNullAndEmptyArrays: true } },
            { $sort: { 'trajet.dateDepart': 1, 'trajet.heureDepart': 1 } } // Tri par date ET heure
        ]);

        // ==========================================================
        // === DÉBUT DE LA NOUVELLE LOGIQUE DE SÉLECTION
        // ==========================================================

        let tripToDisplay = null;
        let upcomingTrips = [];
        let pastTrips = [];
        let activeTrip = null;

        // 1. On classe d'abord tous les voyages et on trouve un voyage actif
        for (const r of allReservations) {
            if (!r.trajet) continue;
            
            const departureDateTime = new Date(`${new Date(r.trajet.dateDepart).toISOString().split('T')[0]}T${r.trajet.heureDepart}:00Z`);
            
            if (departureDateTime > now) {
                upcomingTrips.push(r);
            } else {
                pastTrips.push(r);
                // Si on trouve un voyage en cours, on le met de côté
                if (r.liveTrip && r.liveTrip.status === 'En cours') {
                    activeTrip = r;
                }
            }
        }

        // 2. On applique la logique de priorité pour choisir le voyage à afficher
        if (activeTrip) {
            // Priorité 1: Un voyage est activement suivi.
            tripToDisplay = activeTrip;
        } else if (upcomingTrips.length > 0) {
            // Priorité 2: Il n'y a pas de voyage actif, on prend le prochain à venir.
            tripToDisplay = upcomingTrips[0];
        } else if (pastTrips.length > 0) {
            // Priorité 3 (Fallback): Aucun voyage actif ou à venir, on montre le plus récent.
            tripToDisplay = pastTrips[pastTrips.length - 1]; // Le dernier du tableau trié par date
        }
        
        // 3. On s'assure que le voyage affiché n'est pas dupliqué dans les listes
        if (tripToDisplay) {
            upcomingTrips = upcomingTrips.filter(t => t._id.toString() !== tripToDisplay._id.toString());
            pastTrips = pastTrips.filter(t => t._id.toString() !== tripToDisplay._id.toString());
        }

        // ==========================================================
        // === FIN DE LA NOUVELLE LOGIQUE DE SÉLECTION
        // ==========================================================
        
        const userColis = await Colis.find({ expediteur_email: req.user.email }).sort({ date_enregistrement: -1 }).limit(5);

        res.json({
            tripToDisplay,
            upcomingTrips,
            pastTrips: pastTrips.reverse(), // On inverse pour avoir les plus récents en premier
            colis: userColis,
        });

    } catch (err) {
        console.error("Erreur getClientDashboardData:", err);
        res.status(500).json({ message: err.message });
    }
};