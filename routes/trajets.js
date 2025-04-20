// server/routes/trajets.js
const express = require('express');
const router = express.Router();
const trajetController = require('../controllers/trajets');

router.get('/', trajetController.getTrajets);
router.get('/:id', trajetController.getTrajetById);

module.exports = router;