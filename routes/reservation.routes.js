const express = require('express');
const router = express.Router();
const { protect, isAdmin } = require('../middlewares/auth.middleware');
const {
    createReservationAndPay,
    getReservationByIdPublic,
    getAllReservationsAdmin,
    updateReservationAdmin,
    deleteReservationAdmin
} = require('../controllers/reservation.controller');

// --- Routes Client (protégées par login) ---
router.post('/', protect, createReservationAndPay);
router.get('/:id', protect, getReservationByIdPublic);

// --- Routes Admin ---
router.get('/admin/all', protect, isAdmin, getAllReservationsAdmin);
router.put('/admin/:id', protect, isAdmin, updateReservationAdmin);
router.delete('/admin/:id', protect, isAdmin, deleteReservationAdmin);

module.exports = router;