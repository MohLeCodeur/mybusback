// backend/routes/admin/trajet.routes.js
const express = require('express');
const router = express.Router();
const { createTrajet, getAllTrajetsAdmin, updateTrajet, deleteTrajet } = require('../../controllers/trajet.controller');
const { protect, isAdmin } = require('../../middlewares/auth.middleware');

router.use(protect, isAdmin);

router.route('/')
  .post(createTrajet)
  .get(getAllTrajetsAdmin);

router.route('/:id')
  .put(updateTrajet)
  .delete(deleteTrajet);

module.exports = router;