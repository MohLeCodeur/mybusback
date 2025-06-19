// backend/routes/auth.routes.js
const express = require('express');
const router = express.Router();
const { register, login, getUserProfile } = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth.middleware');
const { body } = require("express-validator"); // <-- Importer 'body'

// --- NOUVELLE PARTIE : RÈGLES DE VALIDATION ---
const registerValidationRules = [
  body('email')
    .isEmail().withMessage("Veuillez fournir une adresse email valide."),
  
  body('mot_de_passe')
    .isLength({ min: 8 }).withMessage("Le mot de passe doit contenir au moins 8 caractères."),
  
  body('telephone')
    .optional({ checkFalsy: true }) // Le champ est optionnel
    .isLength({ min: 8, max: 8 }).withMessage("Le numéro de téléphone doit contenir exactement 8 chiffres.")
    .isNumeric().withMessage("Le numéro de téléphone ne doit contenir que des chiffres."),

  body('prenom')
    .not().isEmpty().trim().escape().withMessage("Le prénom est requis."),
  
  body('nom')
    .not().isEmpty().trim().escape().withMessage("Le nom est requis."),
];
// ---------------------------------------------

// La route d'inscription utilise maintenant les règles de validation avant d'appeler le contrôleur
router.post('/register', registerValidationRules, register);

router.post('/login', login);
router.get('/profile', protect, getUserProfile);

module.exports = router;