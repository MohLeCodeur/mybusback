// backend/routes/admin/reservation.routes.js
const express = require('express');
const router = express.Router();
const { getAllReservationsAdmin, updateReservationAdmin, deleteReservationAdmin } = require('../../controllers/reservation.controller');
const { protect, isAdmin } = require('../../middlewares/auth.middleware');

router.use(protect, isAdmin);

router.get('/all', getAllReservationsAdmin); // URL complète: /api/admin/reservations/all

router.route('/:id')
  .put(updateReservationAdmin)
  .delete(deleteReservationAdmin);

module.exports = router;