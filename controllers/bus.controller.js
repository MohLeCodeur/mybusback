// controllers/bus.controller.js
const Bus = require("../models/bus.model");

// Create a new bus
exports.createBus = async (req, res) => {
  try {
    const bus = await Bus.create(req.body);
    res.status(201).json(bus);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Get all buses or filter by state
exports.getBuses = async (req, res) => {
  try {
    const filter = {};
    if (req.query.etat) filter.etat = req.query.etat;
    const buses = await Bus.find(filter);
    const totalActifs = await Bus.countDocuments({ etat: "en service" });
    res.json({ totalActifs, buses });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get single bus by ID
exports.getBusById = async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) return res.status(404).json({ message: "Bus non trouvé" });
    res.json(bus);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update bus
exports.updateBus = async (req, res) => {
  try {
    const bus = await Bus.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!bus) return res.status(404).json({ message: "Bus non trouvé" });
    res.json(bus);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Delete bus
exports.deleteBus = async (req, res) => {
  try {
    const bus = await Bus.findByIdAndDelete(req.params.id);
    if (!bus) return res.status(404).json({ message: "Bus non trouvé" });
    res.json({ message: "Bus supprimé" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
