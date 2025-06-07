// backend/routes/reservation.routes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const {
    createReservationAndPay,
    getReservationByIdPublic,
} = require('../controllers/reservation.controller');

// Un client connecté peut créer une réservation et voir sa confirmation
router.post('/', protect, createReservationAndPay);
router.get('/:id', protect, getReservationByIdPublic);

module.exports = router;