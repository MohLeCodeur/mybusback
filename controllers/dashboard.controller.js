// backend/controllers/dashboard.controller.js
const mongoose = require('mongoose');
const axios = require('axios');
const Reservation = require('../models/reservation.model');
const LiveTrip = require('../models/LiveTrip.model');
const Colis = require('../models/colis.model');
const Trajet = require('../models/trajet.model');

// ... (la fonction calculateORS_Route reste inchangée)
async function calculateORS_Route(startCoords, endCoords) { /* ... code inchangé ... */ }


exports.getClientDashboardData = async (req, res) => {
    try {
        const now = new Date();
        const clientId = req.user._id;

        // ==========================================================
        // === DÉBUT DE LA CORRECTION : UTILISATION D'UNE AGRÉGATION
        // ==========================================================
        const aggregationPipeline = [
            // 1. Filtrer les réservations de l'utilisateur
            { $match: { client: new mongoose.Types.ObjectId(clientId), statut: 'confirmée' } },
            // 2. Joindre les informations du trajet
            { $lookup: {
                from: 'trajets',
                localField: 'trajet',
                foreignField: '_id',
                as: 'trajet'
            }},
            { $unwind: '$trajet' }, // Dénormaliser le tableau de trajet
            // 3. Joindre les informations du live trip (si elles existent)
            { $lookup: {
                from: 'livetrips', // Nom de la collection MongoDB pour LiveTrip
                localField: 'trajet._id',
                foreignField: 'trajetId',
                as: 'liveTrip'
            }},
            // 4. Formatter le champ liveTrip pour être un objet ou null
            { $addFields: {
                liveTrip: { $arrayElemAt: ['$liveTrip', 0] }
            }},
            // 5. Joindre les informations du bus
            { $lookup: {
                from: 'bus', // Nom de la collection MongoDB pour Bus
                localField: 'trajet.bus',
                foreignField: '_id',
                as: 'trajet.bus'
            }},
            { $unwind: { path: '$trajet.bus', preserveNullAndEmptyArrays: true } },
            // 6. Trier par date de départ
            { $sort: { 'trajet.dateDepart': 1 } }
        ];

        const allReservations = await Reservation.aggregate(aggregationPipeline);
        // ==========================================================
        // === FIN DE LA CORRECTION
        // ==========================================================

        let tripToDisplay = null;
        const upcomingTrips = [];
        const pastTrips = [];

        for (const r of allReservations) {
            if (!r.trajet) continue;
            
            const departureDateTime = new Date(`${new Date(r.trajet.dateDepart).toISOString().split('T')[0]}T${r.trajet.heureDepart}:00Z`);
            const trackingWindowEnd = new Date(departureDateTime.getTime() + (12 * 60 * 60 * 1000));
            
            if (now < departureDateTime) {
                upcomingTrips.push(r);
            } else if (now >= departureDateTime && now <= trackingWindowEnd) {
                if (!tripToDisplay) tripToDisplay = r;
                pastTrips.push(r);
            } else {
                pastTrips.push(r);
            }
        }
        
        if (!tripToDisplay && upcomingTrips.length > 0) {
            tripToDisplay = upcomingTrips.shift();
        }
        
        // La donnée liveTrip est maintenant directement dans l'objet tripToDisplay
        const userColis = await Colis.find({ expediteur_email: req.user.email }).sort({ date_enregistrement: -1 }).limit(5);

        res.json({
            // On renvoie l'objet complet qui contient déjà la réservation et le liveTrip
            tripToDisplay: tripToDisplay,
            upcomingTrips,
            pastTrips: pastTrips.reverse(),
            colis: userColis,
        });

    } catch (err) {
        console.error("Erreur getClientDashboardData:", err);
        res.status(500).json({ message: err.message });
    }
};