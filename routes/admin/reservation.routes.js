// backend/routes/admin/reservation.routes.js
const express = require('express');
const router = express.Router();
const { 
    getAllReservationsAdmin, 
    updateReservationAdmin, 
    deleteReservationAdmin,
    confirmReservationManually // <-- Importer la nouvelle fonction
} = require('../../controllers/reservation.controller');
const { protect, isAdmin } = require('../../middlewares/auth.middleware');

router.use(protect, isAdmin);

router.get('/all', getAllReservationsAdmin);

// --- NOUVELLE ROUTE ---
router.post('/:id/confirm', confirmReservationManually);

router.route('/:id')
  .put(updateReservationAdmin) // Pour la modification simple depuis le formulaire
  .delete(deleteReservationAdmin);

module.exports = router;