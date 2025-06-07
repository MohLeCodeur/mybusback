// Vérifie que l'utilisateur connecté est admin
exports.isAdmin = (req, res, next) => {
  if (req.client && req.client.role === "admin") {
    return next();
  }
  return res
    .status(403)
    .json({ message: "Accès refusé: réservé aux administrateurs" });
};
