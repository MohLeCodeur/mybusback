// routes/vitepay.js
const express = require('express');
const router  = express.Router();
const vitepay = require('../controllers/vitepay');

router.post('/create', vitepay.createPayment);
// routes/vitepay.js (ajout)
router.post('/callback', vitepay.handleCallback);

module.exports = router;
