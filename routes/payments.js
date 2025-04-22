// routes/payments.js
const express = require('express');
const router  = express.Router();
const payments = require('../controllers/payments');

// POST /api/payments
router.post('/', payments.initiatePayment);

// IPN & return si besoin :
router.post('/notify', payments.handleNotify);
router.get('/return', payments.handleReturn);

module.exports = router;
