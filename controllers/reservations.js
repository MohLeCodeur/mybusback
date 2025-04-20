const mongoose   = require('mongoose');   
const Reservation = require('../models/Reservation');
const Trajet = require('../models/Trajet');

// Nouvelle méthode pour obtenir une réservation par ID
exports.getReservationById = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id).populate('trajet');
    if (!reservation) {
      return res.status(404).json({ message: 'Réservation non trouvée' });
    }
    res.json(reservation);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Méthode existante améliorée
exports.createReservation = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { trajetId, client, placesReservees } = req.body;

    // Validation
    if (!trajetId || !client || !placesReservees) {
      return res.status(400).json({ message: 'Tous les champs sont requis' });
    }

    const trajet = await Trajet.findById(trajetId).session(session);
    if (!trajet) {
      return res.status(404).json({ message: 'Trajet non trouvé' });
    }

    if (trajet.placesDisponibles < placesReservees) {
      return res.status(400).json({ 
        message: `Seulement ${trajet.placesDisponibles} places disponibles` 
      });
    }

    const reservation = new Reservation({
      trajet: trajetId,
      client,
      placesReservees
    });

    await reservation.save({ session });
    
    // Mise à jour atomique des places disponibles
    trajet.placesDisponibles -= placesReservees;
    await trajet.save({ session });
    
    await session.commitTransaction();
    res.status(201).json(reservation);
  } catch (err) {
    await session.abortTransaction();
    res.status(400).json({ message: err.message });
  } finally {
    session.endSession();
  }
};

// Méthode existante améliorée
exports.getReservations = async (req, res) => {
  try {
    const reservations = await Reservation.find()
      .populate('trajet')
      .sort({ dateReservation: -1 });
    res.json(reservations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};