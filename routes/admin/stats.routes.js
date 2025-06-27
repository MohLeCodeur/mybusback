// backend/routes/admin/stats.routes.js
const express = require('express');
const router = express.Router();
// --- CORRECTION : Importer la nouvelle fonction ---
const { getRevenus, getPerformanceInsights, getOverviewStats } = require('../../controllers/stats.controller');
const { protect, isAdmin } = require('../../middlewares/auth.middleware');

router.use(protect, isAdmin);

// --- CORRECTION : AJOUT DE LA NOUVELLE ROUTE ---
router.get('/overview', getOverviewStats);
// ---------------------------------------------

router.get('/revenus', getRevenus);
router.get('/performance', getPerformanceInsights);

module.exports = router;