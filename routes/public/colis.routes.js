// backend/routes/public/colis.routes.js
const express = require('express');
const router = express.Router();
const { getColisByCode } = require('../../controllers/colis.controller');
const { protect } = require('../../middlewares/auth.middleware'); // Importer le middleware de protection

// --- ROUTE MODIFIÉE ---
// On ajoute le middleware 'protect' pour s'assurer que seul un utilisateur connecté peut l'appeler.
router.get('/track/:code', protect, getColisByCode);
// --------------------

module.exports = router;