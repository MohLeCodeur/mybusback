// controllers/chauffeur.controller.js
const Chauffeur = require("../models/chauffeur.model");
const Bus = require("../models/bus.model");

/**
 * Crée un nouveau chauffeur en s'assurant que le bus n'est pas déjà pris.
 * POST /api/admin/chauffeurs
 */
exports.createChauffeur = async (req, res) => {
  const { prenom, nom, telephone, bus: busId } = req.body;

  try {
    // Si un busId est fourni, vérifier qu'aucun autre chauffeur n'a déjà ce bus
    if (busId) {
      const conflict = await Chauffeur.findOne({ bus: busId });
      if (conflict) {
        return res
          .status(400)
          .json({ message: "Ce bus est déjà affecté à un autre chauffeur." });
      }
      // Facultatif : vérifier que le bus existe réellement
      const busExists = await Bus.findById(busId);
      if (!busExists) {
        return res.status(404).json({ message: "Bus introuvable." });
      }
    }

    const newChauffeur = await Chauffeur.create({
      prenom,
      nom,
      telephone,
      bus: busId || null,
    });
    return res.status(201).json(newChauffeur);
  } catch (err) {
    console.error("Erreur createChauffeur:", err);
    return res.status(500).json({ message: err.message });
  }
};

/**
 * Met à jour un chauffeur tout en vérifiant l'unicité du bus.
 * PUT /api/admin/chauffeurs/:id
 */
exports.updateChauffeur = async (req, res) => {
  const { id } = req.params;
  const { prenom, nom, telephone, bus: busId } = req.body;

  try {
    // Si un busId est fourni, vérifier qu'aucun autre chauffeur (autre que celui-ci) ne l'a
    if (busId) {
      const conflict = await Chauffeur.findOne({
        bus: busId,
        _id: { $ne: id }, // exclure l'actuel chauffeur de la recherche
      });
      if (conflict) {
        return res
          .status(400)
          .json({ message: "Ce bus est déjà affecté à un autre chauffeur." });
      }
      // Facultatif : vérifier que le bus existe réellement
      const busExists = await Bus.findById(busId);
      if (!busExists) {
        return res.status(404).json({ message: "Bus introuvable." });
      }
    }

    const updated = await Chauffeur.findByIdAndUpdate(
      id,
      { prenom, nom, telephone, bus: busId || null },
      { new: true, runValidators: true }
    );
    if (!updated) {
      return res.status(404).json({ message: "Chauffeur non trouvé." });
    }
    return res.json(updated);
  } catch (err) {
    console.error("Erreur updateChauffeur:", err);
    return res.status(500).json({ message: err.message });
  }
};

/**
 * Récupère la liste de tous les chauffeurs avec leur bus (populé).
 * GET /api/admin/chauffeurs
 */
exports.getChauffeurs = async (req, res) => {
  try {
    const chauffeurs = await Chauffeur.find().populate("bus");
    return res.json(chauffeurs);
  } catch (err) {
    console.error("Erreur getChauffeurs:", err);
    return res.status(500).json({ message: err.message });
  }
};

/**
 * Récupère un chauffeur par ID (avec son bus).
 * GET /api/admin/chauffeurs/:id
 */
exports.getChauffeurById = async (req, res) => {
  try {
    const chauffeur = await Chauffeur.findById(req.params.id).populate("bus");
    if (!chauffeur) {
      return res.status(404).json({ message: "Chauffeur non trouvé." });
    }
    return res.json(chauffeur);
  } catch (err) {
    console.error("Erreur getChauffeurById:", err);
    return res.status(500).json({ message: err.message });
  }
};

/**
 * Supprime un chauffeur (libère automatiquement le bus pour qu’il puisse être réattribué).
 * DELETE /api/admin/chauffeurs/:id
 */
exports.deleteChauffeur = async (req, res) => {
  try {
    const deleted = await Chauffeur.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Chauffeur non trouvé." });
    }
    return res.json({ message: "Chauffeur supprimé." });
  } catch (err) {
    console.error("Erreur deleteChauffeur:", err);
    return res.status(500).json({ message: err.message });
  }
};
