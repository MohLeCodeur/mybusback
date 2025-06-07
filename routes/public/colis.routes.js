// backend/routes/public/colis.routes.js
const express = require('express');
const router = express.Router();
const { getColisByCode } = require('../../controllers/colis.controller');

// Route publique pour que n'importe qui puisse suivre un colis avec son code
router.get('/track/:code', getColisByCode);

module.exports = router;