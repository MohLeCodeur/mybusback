// controllers/client.controller.js
const Client = require("../models/client.model");
const jwt = require("jsonwebtoken");

// Génère un token JWT
const generateToken = (id) => {
  if (!process.env.JWT_SECRET) {
    console.error("ERREUR CRITIQUE: JWT_SECRET n'est pas défini !");
    // Gérer cette erreur de manière appropriée, peut-être en lançant une exception
    // ou en renvoyant une réponse d'erreur au client pour éviter que jwt.sign échoue silencieusement
    // ou avec une erreur cryptique si JWT_SECRET est manquant.
  }
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

// Inscription (le rôle est déterminé par l'email)
exports.inscrireClient = async (req, res) => {
  try {
    const { prenom, nom, email, mot_de_passe } = req.body;

    // Vérifier si l'email existe déjà
    const exists = await Client.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: "Email déjà utilisé" });
    }

    // Déterminer le rôle en fonction du suffixe de l'email
    let role = "client"; // Rôle par défaut
    if (email && email.toLowerCase().endsWith("@admin.ml")) { // Vérifie si l'email se termine par @admin.ml (insensible à la casse)
      role = "admin";
    }

    const client = await Client.create({
      prenom,
      nom,
      email,
      mot_de_passe,
      role, // Utilise le rôle déterminé
    });

    return res.status(201).json({
      _id: client._id,
      prenom: client.prenom,
      nom: client.nom,
      email: client.email,
      role: client.role, // Renvoie le rôle attribué
      token: generateToken(client._id),
    });
  } catch (err) {
    console.error("Erreur dans inscrireClient:", err); // Logguer l'erreur côté serveur
    return res.status(500).json({ message: err.message });
  }
};

// Connexion (reste inchangée pour le moment, mais vérifiez la logique si nécessaire)
exports.connecterClient = async (req, res) => {
  try {
    const { email, mot_de_passe } = req.body;
    // console.log(`[Login Attempt] Email: ${email}, Mot de passe fourni: ${mot_de_passe}`);

    const client = await Client.findOne({ email });

    if (!client) {
      // console.log(`[Login Failed] Aucun client trouvé pour l'email: ${email}`);
      return res.status(401).json({ message: "Identifiants invalides" });
    }

    // console.log(`[Login Attempt] Client trouvé: ${client.email}, Rôle: ${client.role}`);
    const isMatch = await client.matchPassword(mot_de_passe);

    if (!isMatch) {
      // console.log(`[Login Failed] Le mot de passe ne correspond pas pour l'email: ${email}`);
      return res.status(401).json({ message: "Identifiants invalides" });
    }

    // console.log(`[Login Success] Connexion réussie pour: ${email}`);
    return res.json({
      _id: client._id,
      prenom: client.prenom,
      nom: client.nom,
      email: client.email,
      role: client.role,
      token: generateToken(client._id),
    });
  } catch (err) {
    console.error("[Login Error] Erreur interne lors de la tentative de connexion:", err);
    return res.status(500).json({ message: err.message });
  }
};

// Profil protégé (reste inchangée)
exports.profilClient = async (req, res) => {
  const client = req.client; // req.client est défini par le middleware d'authentification
  res.json({
    _id: client._id,
    prenom: client.prenom,
    nom: client.nom,
    email: client.email,
    role: client.role,
  });
};

// La fonction inscrireClientAdmin n'est plus nécessaire si la logique ci-dessus est adoptée
// Vous pouvez la commenter ou la supprimer
/*
exports.inscrireClientAdmin = async (req, res) => {
  // ... (ancien code)
};
*/