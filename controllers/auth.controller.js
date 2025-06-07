// backend/controllers/auth.controller.js
const Client = require("../models/client.model");
const jwt = require("jsonwebtoken");

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

// POST /api/auth/register
exports.register = async (req, res) => {
  const { prenom, nom, email, mot_de_passe, telephone } = req.body;
  try {
    const userExists = await Client.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "Cet email est déjà utilisé" });
    }

    // =======================================================
    // === NOUVELLE LOGIQUE D'ASSIGNATION DE RÔLE ===
    // =======================================================
    let role = 'client'; // Par défaut, le rôle est 'client'

    // Vérifie si l'email se termine par "@admin.ml"
    if (email && email.toLowerCase().endsWith('@admin.ml')) {
      role = 'admin'; // Si c'est le cas, on assigne le rôle 'admin'
    }
    // =======================================================

    // On crée l'utilisateur avec le rôle déterminé
    const user = await Client.create({ 
      prenom, 
      nom, 
      email, 
      mot_de_passe, 
      telephone, 
      role // On utilise la variable 'role' ici
    });

    console.log(`Nouvel utilisateur inscrit: ${user.email} avec le rôle: ${user.role}`); // Log pour le débogage

    res.status(201).json({
      _id: user._id,
      prenom: user.prenom,
      nom: user.nom,
      email: user.email,
      role: user.role, // On renvoie le bon rôle au frontend
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