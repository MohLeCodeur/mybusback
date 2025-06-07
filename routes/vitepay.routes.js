// backend/routes/vitepay.routes.js
const express = require('express');
const router = express.Router();
const { handleCallback } = require('../controllers/vitepay.controller');

router.post('/callback', handleCallback);

module.exports = router;