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
    const allReservations = await Reservation.find({
      client: clientId,
      statut: 'confirmée'
    })
    .populate({
      path: 'trajet',
      populate: { path: 'bus', select: 'numero' }
    })
    .sort({ 'trajet.dateDepart': -1 });

    // --- 2. NOUVELLE LOGIQUE : Prioriser les voyages dans la fenêtre de suivi ---
    let nextTripData = null;
    const pastReservations = [];
    
    for (const r of allReservations) {
      if (!r.trajet) continue;
      
      const departureDateTime = new Date(`${new Date(r.trajet.dateDepart).toISOString().split('T')[0]}T${r.trajet.heureDepart}:00`);
      
      // Calculer la fenêtre de suivi de 5 heures après le départ
      const fiveHoursAfterDeparture = new Date(departureDateTime.getTime() + (5 * 60 * 60 * 1000));
      
      // Voyages futurs OU en cours (dans la fenêtre de 5 heures)
      if (departureDateTime >= now || (now >= departureDateTime && now <= fiveHoursAfterDeparture)) {
        if (!nextTripData) {
          const liveTrip = await LiveTrip.findOne({ trajetId: r.trajet._id });
          nextTripData = {
            reservation: r,
            liveTrip: liveTrip || null
          };
        }
      } 
      // Voyages passés (plus de 5 heures après le départ)
      else if (now > fiveHoursAfterDeparture) {
        pastReservations.push(r);
      }
    }

    // --- 3. Récupérer les colis de l'utilisateur ---
    const userColis = await Colis.find({
      expediteur_email: req.user.email
    })
    .sort({ date_enregistrement: -1 })
    .limit(5);

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
