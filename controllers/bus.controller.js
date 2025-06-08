// backend/controllers/bus.controller.js
const Bus = require("../models/bus.model");
const Trajet = require("../models/trajet.model");
const Reservation = require("../models/reservation.model");

// GET /api/admin/bus
exports.getBuses = async (req, res) => {
  try {
    // 1. Récupérer tous les bus
    const buses = await Bus.find({}).lean(); // .lean() pour un objet JS simple, plus rapide

    // 2. Pour chaque bus, calculer les places réservées et trouver le prochain trajet
    const busesWithStats = await Promise.all(
      buses.map(async (bus) => {
        // Trouver tous les trajets futurs pour ce bus
        const trajetsFuturs = await Trajet.find({ 
          bus: bus._id,
          dateDepart: { $gte: new Date() } // Uniquement les trajets à partir d'aujourd'hui
        }).sort({ dateDepart: 1 });

        let totalPlacesReservees = 0;
        let prochainTrajet = null;

        if (trajetsFuturs.length > 0) {
            prochainTrajet = {
                destination: `${trajetsFuturs[0].villeDepart} → ${trajetsFuturs[0].villeArrivee}`,
                date: trajetsFuturs[0].dateDepart,
            };

            // Pour chaque trajet futur, trouver le nombre de places réservées
            const reservations = await Reservation.find({
                trajet: { $in: trajetsFuturs.map(t => t._id) },
                statut: 'confirmée' // On ne compte que les réservations confirmées
            });

            totalPlacesReservees = reservations.reduce((sum, r) => sum + r.placesReservees, 0);
        }

        return {
          ...bus,
          placesReservees: totalPlacesReservees,
          prochainTrajet: prochainTrajet
        };
      })
    );

    res.json(busesWithStats);

  } catch (err) {
    console.error("Erreur getBuses:", err);
    res.status(500).json({ message: err.message });
  }
};


// Le reste des fonctions (createBus, getBusById, etc.) reste le même
// ...

// POST /api/admin/bus
exports.createBus = async (req, res) => {
  try {
    const bus = await Bus.create(req.body);
    res.status(201).json(bus);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// GET /api/admin/bus/:id
exports.getBusById = async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) return res.status(404).json({ message: "Bus non trouvé" });
    res.json(bus);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/admin/bus/:id
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

// DELETE /api/admin/bus/:id
exports.deleteBus = async (req, res) => {
  try {
    const bus = await Bus.findByIdAndDelete(req.params.id);
    if (!bus) return res.status(404).json({ message: "Bus non trouvé" });
    res.json({ message: "Bus supprimé" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};