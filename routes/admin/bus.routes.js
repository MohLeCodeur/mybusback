// backend/routes/admin/bus.routes.js
const express = require('express');
const router = express.Router();
const { createBus, getBuses, getBusById, updateBus, deleteBus } = require('../../controllers/bus.controller');
const { protect, isAdmin } = require('../../middlewares/auth.middleware');

// Protège toutes les routes de ce fichier
router.use(protect, isAdmin);

router.route('/')
  .post(createBus)
  .get(getBuses);

router.route('/:id')
  .get(getBusById)
  .put(updateBus)
  .delete(deleteBus);

module.exports = router;