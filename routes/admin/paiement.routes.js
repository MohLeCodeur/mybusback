// backend/routes/admin/paiement.routes.js
const express = require('express');
const router = express.Router();
const { getPaiements } = require('../../controllers/paiement.controller');
const { protect, isAdmin } = require('../../middlewares/auth.middleware');

// Protège toutes les routes de ce fichier. Seul un admin peut y accéder.
router.use(protect, isAdmin);

// La route GET '/' correspondra à /api/admin/paiements/
router.get('/', getPaiements);

module.exports = router;