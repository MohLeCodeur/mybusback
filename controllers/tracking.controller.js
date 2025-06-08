// backend/controllers/tracking.controller.js
const Reservation = require('../models/reservation.model');
const LiveTrip = require('../models/LiveTrip.model');
const Trajet = require('../models/trajet.model');

// ... (les fonctions startTrip et updateBusPosition restent les mêmes)

/**
 * @desc    Pour le client, récupère les informations de son prochain voyage confirmé
 * @route   GET /api/tracking/my-next-trip
 * @access  Privé (client connecté)
 */
exports.getMyNextTrip = async (req, res) => {
    try {
        const now = new Date();

        // 1. Trouver toutes les réservations confirmées pour ce client
        const allConfirmedReservations = await Reservation.find({
            client: req.user._id,
            statut: 'confirmée',
        }).populate('trajet'); // On peuple tous les trajets

        if (!allConfirmedReservations || allConfirmedReservations.length === 0) {
            return res.json({ message: "Vous n'avez aucune réservation confirmée." });
        }

        // 2. Filtrer en JavaScript pour ne garder que les trajets futurs
        const futureReservations = allConfirmedReservations.filter(
            res => res.trajet && new Date(res.trajet.dateDepart) >= now
        );

        if (futureReservations.length === 0) {
            return res.json({ message: "Vous n'avez aucun voyage à venir." });
        }

        // 3. Trier pour trouver le voyage le plus proche dans le temps
        futureReservations.sort((a, b) => new Date(a.trajet.dateDepart) - new Date(b.trajet.dateDepart));
        
        const nextReservation = futureReservations[0];

        // 4. Vérifier s'il y a un LiveTrip associé à ce prochain trajet
        const liveTrip = await LiveTrip.findOne({ trajetId: nextReservation.trajet._id });

        res.json({
            reservation: nextReservation,
            liveTrip: liveTrip || null,
        });

    } catch (err) {
        console.error("Erreur getMyNextTrip:", err);
        res.status(500).json({ message: err.message });
    }
};


// ... (le reste du fichier, startTrip et updateBusPosition, si vous les avez)
exports.startTrip = async (req, res) => { /* ... */ };
exports.updateBusPosition = async (req, res) => { /* ... */ };