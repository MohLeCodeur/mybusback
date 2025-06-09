// backend/routes/dashboard.routes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { getClientDashboardData } = require('../controllers/dashboard.controller');

router.get('/client-data', protect, getClientDashboardData);

module.exports = router;