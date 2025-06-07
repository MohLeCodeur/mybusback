const express = require('express');
const router = express.Router();
const { protect, isAdmin } = require('../middlewares/auth.middleware');
const { 
    searchTrajets,
    getTrajetByIdPublic,
    createTrajet,
    getAllTrajetsAdmin,
    updateTrajet,
    deleteTrajet 
} = require('../controllers/trajet.controller');

// --- Routes Publiques ---
router.get('/search', searchTrajets);
router.get('/:id', getTrajetByIdPublic);

// --- Routes Admin ---
router.route('/admin')
    .post(protect, isAdmin, createTrajet)
    .get(protect, isAdmin, getAllTrajetsAdmin);

router.route('/admin/:id')
    .put(protect, isAdmin, updateTrajet)
    .delete(protect, isAdmin, deleteTrajet);

module.exports = router;