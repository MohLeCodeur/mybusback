// backend/controllers/trajet.controller.js
const Trajet = require('../models/trajet.model');

/**
 * @desc    Rechercher des trajets - VERSION DE TEST 1
 * @route   GET /api/public/trajets/search
 * @access  Public
 */
exports.searchTrajets = async (req, res) => {
  try {
    // --- TEST 1 : ON IGNORE TOUS LES FILTRES POUR VOIR SI DES DONNÉES EXISTENT ---
    let queryFilter = {}; // Le filtre est complètement vide.
    // --------------------------------------------------------------------------
    
    console.log("--- DÉBUT DU TEST 1 ---");
    console.log("Filtre MongoDB appliqué (vide pour test) :", JSON.stringify(queryFilter));

    const { limit = 15, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [docs, total] = await Promise.all([
      Trajet.find(queryFilter)
        .populate('bus', 'numero capacite etat')
        .sort({ dateDepart: 1 }) // On garde le tri pour la cohérence
        .skip(skip)
        .limit(parseInt(limit)),
      Trajet.countDocuments(queryFilter)
    ]);
    
    console.log(`RÉSULTAT DU TEST 1 : ${total} trajet(s) trouvé(s) au total, ${docs.length} renvoyé(s) pour la page ${page}.`);
    console.log("--- FIN DU TEST 1 ---");

    res.json({
      docs,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });

  } catch (err) {
    console.error("Erreur [searchTrajets - TEST 1]:", err);
    res.status(500).json({ message: "Erreur serveur lors de la recherche des trajets." });
  }
};


// ==============================================================
// Les autres fonctions restent inchangées
// ==============================================================

/**
 * @desc    Récupérer les détails d'un seul trajet pour l'interface publique
 * @route   GET /api/public/trajets/:id
 * @access  Public
 */
exports.getTrajetByIdPublic = async (req, res) => {
    try {
        const trajet = await Trajet.findById(req.params.id).populate('bus');
        if (!trajet) {
          return res.status(404).json({ message: 'Trajet non trouvé' });
        }
        res.json(trajet);
    } catch (err) {
        console.error("Erreur [getTrajetByIdPublic]:", err);
        res.status(500).json({ message: "Erreur serveur." });
    }
};

/**
 * @desc    Créer un nouveau trajet
 * @route   POST /api/admin/trajets
 * @access  Admin
 */
exports.createTrajet = async (req, res) => {
  try {
    const newTrajet = new Trajet(req.body);
    const savedTrajet = await newTrajet.save();
    res.status(201).json(savedTrajet);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * @desc    Récupérer tous les trajets pour le tableau de bord admin
 * @route   GET /api/admin/trajets
 * @access  Admin
 */
exports.getAllTrajetsAdmin = async (req, res) => {
  try {
    const trajets = await Trajet.find({}).populate('bus').sort({ dateDepart: -1 });
    res.json(trajets);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * @desc    Mettre à jour un trajet existant
 * @route   PUT /api/admin/trajets/:id
 * @access  Admin
 */
exports.updateTrajet = async (req, res) => {
  try {
    const updatedTrajet = await Trajet.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updatedTrajet) {
      return res.status(404).json({ message: "Trajet non trouvé" });
    }
    res.json(updatedTrajet);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * @desc    Supprimer un trajet
 * @route   DELETE /api/admin/trajets/:id
 * @access  Admin
 */
exports.deleteTrajet = async (req, res) => {
  try {
    const deletedTrajet = await Trajet.findByIdAndDelete(req.params.id);
    if (!deletedTrajet) {
      return res.status(404).json({ message: "Trajet non trouvé" });
    }
    res.json({ message: "Trajet supprimé avec succès" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};