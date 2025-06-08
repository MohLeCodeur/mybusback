// backend/controllers/paiement.controller.js
const Reservation = require('../models/reservation.model');

/**
 * @desc    Récupérer tous les paiements (réservations confirmées)
 * @route   GET /api/admin/paiements
 * @access  Admin
 */
exports.getPaiements = async (req, res) => {
    try {
        // On ne récupère que les réservations dont le statut est 'confirmée'
        const paiements = await Reservation.find({ statut: 'confirmée' })
            .populate('client', 'prenom nom email')
            .populate({
                path: 'trajet',
                select: 'villeDepart villeArrivee prix',
            })
            .sort({ dateReservation: -1 });
        
        // La page StatsPage fait maintenant les calculs, donc on renvoie juste la liste
        res.json({ paiements });

    } catch (err) {
        console.error("Erreur getPaiements:", err);
        res.status(500).json({ message: err.message });
    }
};