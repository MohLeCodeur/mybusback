// backend/middlewares/auth.middleware.js
const jwt = require("jsonwebtoken");
const Client = require("../models/client.model");

// Protège les routes, vérifie si l'utilisateur est connecté
exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Récupère le token du header
      token = req.headers.authorization.split(" ")[1];

      // Vérifie le token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Récupère l'utilisateur depuis la DB et l'attache à la requête
      req.user = await Client.findById(decoded.id).select("-mot_de_passe");

      if (!req.user) {
         return res.status(401).json({ message: "Non autorisé, utilisateur non trouvé" });
      }

      next();
    } catch (error) {
      return res.status(401).json({ message: "Non autorisé, token invalide" });
    }
  }

  if (!token) {
    return res.status(401).json({ message: "Non autorisé, pas de token" });
  }
};

// Vérifie si l'utilisateur connecté est un admin
exports.isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ message: "Accès refusé. Rôle administrateur requis." });
  }
};