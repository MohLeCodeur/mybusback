// backend/routes/admin/chauffeur.routes.js
const express = require('express');
const router = express.Router();
const { createChauffeur, getChauffeurs, getChauffeurById, updateChauffeur, deleteChauffeur } = require('../../controllers/chauffeur.controller');
const { protect, isAdmin } = require('../../middlewares/auth.middleware');

router.use(protect, isAdmin);

router.route('/')
  .post(createChauffeur)
  .get(getChauffeurs);

router.route('/:id')
  .get(getChauffeurById)
  .put(updateChauffeur)
  .delete(deleteChauffeur);

module.exports = router;