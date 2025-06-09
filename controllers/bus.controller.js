// backend/controllers/bus.controller.js
const Bus = require("../models/bus.model");
const mongoose = require('mongoose'); // Important pour les opérations avancées

/**
 * @desc    Récupérer tous les bus avec leurs statistiques d'occupation et leur prochain trajet.
 *          Utilise une agrégation MongoDB pour des performances optimales.
 * @route   GET /api/admin/bus
 * @access  Admin
 */
exports.getBuses = async (req, res) => {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // Début de la journée actuelle en UTC pour une comparaison juste

    const aggregationPipeline = [
      // Étape 1: Jointure avec la collection 'trajets' pour trouver tous les trajets assignés à chaque bus
      {
        $lookup: {
          from: 'trajets', // Le nom de la collection dans MongoDB
          localField: '_id',
          foreignField: 'bus',
          as: 'trajetsAssignes'
        }
      },
      // Étape 2: Ajouter des champs calculés à chaque document de bus
      {
        $addFields: {
          // Créer un tableau ne contenant que les trajets futurs
          trajetsFuturs: {
            $filter: {
              input: '$trajetsAssignes',
              as: 'trajet',
              cond: { $gte: ['$$trajet.dateDepart', today] }
            }
          }
        }
      },
      // Étape 3: Faire une autre jointure pour récupérer les réservations des trajets futurs
      {
        $lookup: {
          from: 'reservations',
          localField: 'trajetsFuturs._id',
          foreignField: 'trajet',
          as: 'reservationsFutures'
        }
      },
      // Étape 4: Projeter (formater) le résultat final
      {
        $project: {
          _id: 1, // Garder les champs originaux du bus
          numero: 1,
          etat: 1,
          capacite: 1,
          createdAt: 1,
          updatedAt: 1,
          // Calculer la somme des places réservées uniquement pour les réservations 'confirmée'
          placesReservees: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$reservationsFutures",
                    as: "res",
                    cond: { $eq: ["$$res.statut", "confirmée"] }
                  }
                },
                as: "reservation",
                in: "$$reservation.placesReservees"
              }
            }
          },
          // Trier les trajets futurs par date et prendre le premier pour l'afficher
          prochainTrajet: {
            $first: {
              $sortArray: {
                input: "$trajetsFuturs",
                sortBy: { dateDepart: 1 }
              }
            }
          }
        }
      }
    ];

    const busesWithStats = await Bus.aggregate(aggregationPipeline);
    
    // Simplifier l'objet 'prochainTrajet' pour qu'il soit plus facile à utiliser sur le frontend
    const finalResult = busesWithStats.map(bus => ({
        ...bus,
        prochainTrajet: bus.prochainTrajet ? {
            destination: `${bus.prochainTrajet.villeDepart} → ${bus.prochainTrajet.villeArrivee}`,
            date: bus.prochainTrajet.dateDepart
        } : null
    }));

    res.json(finalResult);

  } catch (err) {
    console.error("Erreur [getBuses]:", err);
    res.status(500).json({ message: "Erreur serveur lors de la récupération des bus." });
  }
};


/**
 * @desc    Créer un nouveau bus
 * @route   POST /api/admin/bus
 * @access  Admin
 */
exports.createBus = async (req, res) => {
  try {
    const bus = await Bus.create(req.body);
    res.status(201).json(bus);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * @desc    Récupérer un bus par son ID
 * @route   GET /api/admin/bus/:id
 * @access  Admin
 */
exports.getBusById = async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) return res.status(404).json({ message: "Bus non trouvé" });
    res.json(bus);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * @desc    Mettre à jour un bus
 * @route   PUT /api/admin/bus/:id
 * @access  Admin
 */
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

/**
 * @desc    Supprimer un bus
 * @route   DELETE /api/admin/bus/:id
 * @access  Admin
 */
exports.deleteBus = async (req, res) => {
  try {
    const bus = await Bus.findByIdAndDelete(req.params.id);
    if (!bus) return res.status(404).json({ message: "Bus non trouvé" });
    res.json({ message: "Bus supprimé avec succès" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};