const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservations');

router.post('/', reservationController.createReservation);
router.get('/', reservationController.getReservations);
router.get('/:id', reservationController.getReservationById); // Nouvelle route

module.exports = router;