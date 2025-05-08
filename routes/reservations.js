// routes/reservations.js
const express = require('express');
const router  = express.Router();

// Importer les fonctions du controller sans les appeler
const {
  getReservations,
  getReservationById,
  createReservation
} = require('../controllers/reservations');

// Route pour lister toutes les réservations
router.get('/', getReservations);

// Route pour récupérer une réservation par ID
router.get('/:id', getReservationById);

// Route pour créer une réservation (POST)
router.post('/', createReservation);

module.exports = router;
