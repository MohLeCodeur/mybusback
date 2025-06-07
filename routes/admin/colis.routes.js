// backend/routes/admin/colis.routes.js
const express = require('express');
const router = express.Router();
const { creerColis, getAllColis, getColisById, updateStatutColis, updateColis } = require('../../controllers/colis.controller');
const { protect, isAdmin } = require('../../middlewares/auth.middleware');

router.use(protect, isAdmin);

router.route('/')
  .post(creerColis)
  .get(getAllColis);

router.route('/:id')
  .get(getColisById)
  .put(updateColis);

router.put('/:id/statut', updateStatutColis);

module.exports = router;