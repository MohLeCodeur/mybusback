// controllers/ville.controller.js
const { Ville, Tarif } = require("../models/ville.model");

// Create Ville
exports.createVille = async (req, res) => {
  try {
    const v = await Ville.create(req.body);
    res.status(201).json(v);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Get all Villes
exports.getVilles = async (req, res) => {
  try {
    const list = await Ville.find();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update Ville
exports.updateVille = async (req, res) => {
  try {
    const v = await Ville.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!v) return res.status(404).json({ message: "Ville non trouvée" });
    res.json(v);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Delete Ville
exports.deleteVille = async (req, res) => {
  try {
    const v = await Ville.findByIdAndDelete(req.params.id);
    if (!v) return res.status(404).json({ message: "Ville non trouvée" });
    res.json({ message: "Ville supprimée" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create Tarif
exports.createTarif = async (req, res) => {
  try {
    const t = await Tarif.create(req.body);
    res.status(201).json(t);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Get all Tarifs
exports.getTarifs = async (req, res) => {
  try {
    const list = await Tarif.find().populate("depart arrivee");
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update Tarif
exports.updateTarif = async (req, res) => {
  try {
    const t = await Tarif.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!t) return res.status(404).json({ message: "Tarif non trouvé" });
    res.json(t);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Delete Tarif
exports.deleteTarif = async (req, res) => {
  try {
    const t = await Tarif.findByIdAndDelete(req.params.id);
    if (!t) return res.status(404).json({ message: "Tarif supprimé" });
    res.json({ message: "Tarif supprimé" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
