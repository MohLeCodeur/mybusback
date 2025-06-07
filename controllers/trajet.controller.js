// backend/controllers/trajet.controller.js
const Trajet = require('../models/trajet.model');

// PUBLIC - Recherche de trajets avec pagination
exports.searchTrajets = async (req, res) => {
  try {
    const { villeDepart, villeArrivee, date, limit = 15, page = 1 } = req.query;

    const query = {};
    if (villeDepart) query.villeDepart = { $regex: new RegExp(villeDepart, 'i') };
    if (villeArrivee) query.villeArrivee = { $regex: new RegExp(villeArrivee, 'i') };
    if (date) {
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
        query.dateDepart = { $gte: startDate, $lte: endDate };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [docs, total] = await Promise.all([
      Trajet.find(query).populate('bus', 'numero capacite').skip(skip).limit(parseInt(limit)).sort({ dateDepart: 1 }),
      Trajet.countDocuments(query)
    ]);

    res.json({
      docs,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUBLIC - Récupérer un trajet par ID
exports.getTrajetByIdPublic = async (req, res) => {
    try {
        const trajet = await Trajet.findById(req.params.id).populate('bus');
        if (!trajet) return res.status(404).json({ message: 'Trajet non trouvé' });
        res.json(trajet);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


// ADMIN - Créer un trajet
exports.createTrajet = async (req, res) => {
  try {
    const t = await Trajet.create(req.body);
    res.status(201).json(t);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ADMIN - Récupérer tous les trajets (pour la gestion)
exports.getAllTrajetsAdmin = async (req, res) => {
  try {
    const list = await Trajet.find().populate('bus');
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ADMIN - Mettre à jour un trajet
exports.updateTrajet = async (req, res) => {
  try {
    const t = await Trajet.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!t) return res.status(404).json({ message: "Trajet non trouvé" });
    res.json(t);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ADMIN - Supprimer un trajet
exports.deleteTrajet = async (req, res) => {
  try {
    const t = await Trajet.findByIdAndDelete(req.params.id);
    if (!t) return res.status(404).json({ message: "Trajet supprimé" });
    res.json({ message: "Trajet supprimé avec succès" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};