// backend/routes/public/trajet.routes.js
const express = require('express');
const router = express.Router();
const { searchTrajets, getTrajetByIdPublic } = require('../../controllers/trajet.controller');

// Routes publiques pour la recherche de trajets
router.get('/search', searchTrajets);
router.get('/:id', getTrajetByIdPublic);

module.exports = router;