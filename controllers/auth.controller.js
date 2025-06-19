// backend/controllers/auth.controller.js
const Client = require("../models/client.model");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

// POST /api/auth/register
exports.register = async (req, res) => {
  // --- NOUVELLE PARTIE : VÉRIFICATION DES RÉSULTATS DE VALIDATION ---
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // S'il y a des erreurs, on renvoie la première au client
    return res.status(400).json({ message: errors.array()[0].msg });
  }
  // -----------------------------------------------------------------

  const { prenom, nom, email, mot_de_passe, telephone } = req.body;
  try {
    const userExists = await Client.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "Cet email est déjà utilisé." });
    }

    let role = 'client';
    if (email && email.toLowerCase().endsWith('@admin.ml')) {
      role = 'admin';
    }
    
    const user = await Client.create({ prenom, nom, email, mot_de_passe, telephone, role });

    res.status(201).json({
      _id: user._id, prenom: user.prenom, nom: user.nom,
      email: user.email, role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/auth/login (aucun changement ici, la logique reste la même)
exports.login = async (req, res) => {
  const { email, mot_de_passe } = req.body;
  try {
    const user = await Client.findOne({ email });
    if (user && (await user.matchPassword(mot_de_passe))) {
      res.json({
        _id: user._id,
        prenom: user.prenom,
        nom: user.nom,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: "Email ou mot de passe invalide" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/auth/profile (aucun changement ici)
exports.getUserProfile = async (req, res) => {
  res.json(req.user);
};