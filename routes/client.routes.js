// routes/client.routes.js
const express = require("express");
const router = express.Router();

const {
  inscrireClient,
  connecterClient,
  profilClient,
  // inscrireClientAdmin, // Commentez ou supprimez si la fonction contrôleur est supprimée
} = require("../controllers/client.controller");

const protect = require("../middlewares/auth");
const { isAdmin } = require("../middlewares/role");

// ---------- Routes PUBLIQUES ----------
// L'inscription se fait maintenant via cette route unique, le rôle est déterminé par l'email
router.post("/register", inscrireClient); // POST /api/clients/register
router.post("/login", connecterClient);   // POST /api/clients/login

// ---------- Routes PROTÉGÉES (token requis) ----------
router.get("/profile", protect, profilClient); // GET /api/clients/profile

// Route pour tester l'accès admin (peut rester si utile pour vos tests)
router.get("/admin-only", protect, isAdmin, (req, res) => {
  res.json({ message: "Accès Admin OK" });
});

// La route pour inscrire un admin via une autre route devient redondante
// router.post("/register-admin", protect, isAdmin, inscrireClientAdmin); // Commentez ou supprimez

module.exports = router;