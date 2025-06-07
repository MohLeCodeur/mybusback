// backend/routes/admin/stats.routes.js
const express = require('express');
const router = express.Router();
const { getRevenus } = require('../../controllers/stats.controller');
const { protect, isAdmin } = require('../../middlewares/auth.middleware');

router.use(protect, isAdmin);

router.get('/revenus', getRevenus);

module.exports = router;