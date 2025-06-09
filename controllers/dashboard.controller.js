// backend/controllers/dashboard.controller.js
const Reservation = require('../models/reservation.model');
const LiveTrip = require('../models/LiveTrip.model');
const Colis = require('../models/colis.model');

/**
 * @desc    Récupérer toutes les données pour le dashboard client
 * @route   GET /api/dashboard/client-data
 * @access  Privé (client connecté)
 */
exports.getClientDashboardData = async (req, res) => {
    try {
        const now = new Date();
        const clientId = req.user._id;

        // --- 1. Récupérer toutes les réservations confirmées de l'utilisateur ---
        const allReservations = await Reservation.find({ client: clientId, statut: 'confirmée' })
            .populate({
                path: 'trajet',
                populate: { path: 'bus', select: 'numero' }
            })
            .sort({ 'trajet.dateDepart': -1 }); // Trier de la plus récente à la plus ancienne

        // --- 2. Séparer les voyages futurs et passés ---
        const futureReservations = [];
        const pastReservations = [];

        for (const r of allReservations) {
            if (r.trajet) {
                const departureDateTime = new Date(`${new Date(r.trajet.dateDepart).toISOString().split('T')[0]}T${r.trajet.heureDepart}:00`);
                if (departureDateTime >= now) {
                    futureReservations.push(r);
                } else {
                    pastReservations.push(r);
                }
            }
        }
        
        // Trier les voyages futurs du plus proche au plus lointain
        futureReservations.sort((a, b) => new Date(a.trajet.dateDepart) - new Date(b.trajet.dateDepart));
        
        let nextTripData = null;
        if (futureReservations.length > 0) {
            const nextReservation = futureReservations[0];
            const liveTrip = await LiveTrip.findOne({ trajetId: nextReservation.trajet._id });
            nextTripData = { reservation: nextReservation, liveTrip: liveTrip || null };
        }

        // --- 3. Récupérer les colis de l'utilisateur ---
        // On cherche par email ou téléphone. Ici, on suppose que l'email de l'expéditeur est celui du client.
        const userColis = await Colis.find({ expediteur_email: req.user.email }) // Il faut ajouter 'expediteur_email' au modèle Colis
            .sort({ date_enregistrement: -1 })
            .limit(5); // On limite aux 5 plus récents

        // --- 4. Renvoyer toutes les données ---
        res.json({
            nextTrip: nextTripData,
            pastTrips: pastReservations,
            colis: userColis
        });

    } catch (err) {
        console.error("Erreur getClientDashboardData:", err);
        res.status(500).json({ message: err.message });
    }
};