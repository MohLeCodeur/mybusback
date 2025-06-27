// backend/routes/admin/stats.routes.js
const express = require('express');
const router = express.Router();
// --- CORRECTION : Importer les deux fonctions ---
const { getRevenus, getPerformanceInsights } = require('../../controllers/stats.controller');
const { protect, isAdmin } = require('../../middlewares/auth.middleware');

router.use(protect, isAdmin);

router.get('/revenus', getRevenus);

// --- NOUVELLE ROUTE ---
router.get('/performance', getPerformanceInsights);

module.exports = router;