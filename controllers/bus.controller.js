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
    const { page = 1, limit = 7, sortBy = 'numero_asc', search = '', etat = '' } = req.query;
    
    // --- Étape 1: Filtre de base ($match) ---
    let matchStage = {};
    if (search) {
        matchStage.numero = { $regex: search, $options: 'i' };
    }
    if (etat) {
        matchStage.etat = etat;
    }

    // --- Étape 2: Pipeline d'agrégation commun ---
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    let aggregationPipeline = [
      // Appliquer le filtre initial s'il y en a un
      ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
      // Le reste du pipeline de calcul reste le même
      { $lookup: { from: 'trajets', localField: '_id', foreignField: 'bus', as: 'trajetsAssignes' } },
      { $addFields: { trajetsFuturs: { $filter: { input: '$trajetsAssignes', as: 'trajet', cond: { $gte: ['$$trajet.dateDepart', today] } } } } },
      { $lookup: { from: 'reservations', localField: 'trajetsFuturs._id', foreignField: 'trajet', as: 'reservationsFutures' } },
      { $project: {
          _id: 1, numero: 1, etat: 1, capacite: 1, createdAt: 1, updatedAt: 1,
          placesReservees: { $sum: { $map: { input: { $filter: { input: "$reservationsFutures", as: "res", cond: { $eq: ["$$res.statut", "confirmée"] } } }, as: "reservation", in: "$$reservation.placesReservees" } } },
          prochainTrajet: { $first: { $sortArray: { input: "$trajetsFuturs", sortBy: { dateDepart: 1 } } } }
      }}
    ];

    // --- Étape 3: Tri ---
    let sortOptions = {};
    switch(sortBy) {
        case 'numero_desc': sortOptions.numero = -1; break;
        case 'capacite_asc': sortOptions.capacite = 1; break;
        case 'capacite_desc': sortOptions.capacite = -1; break;
        case 'numero_asc':
        default: sortOptions.numero = 1; break;
    }

    // --- Étape 4: Pagination avec $facet ---
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;
    
    const paginatedPipeline = [
        ...aggregationPipeline,
        { $sort: sortOptions },
        { $facet: {
            docs: [{ $skip: skip }, { $limit: limitNum }],
            totalCount: [{ $count: 'total' }]
        }}
    ];

    const results = await Bus.aggregate(paginatedPipeline);
    
    const docs = results[0].docs.map(bus => ({
        ...bus,
        prochainTrajet: bus.prochainTrajet ? {
            destination: `${bus.prochainTrajet.villeDepart} → ${bus.prochainTrajet.villeArrivee}`,
            date: bus.prochainTrajet.dateDepart
        } : null
    }));
    const total = results[0].totalCount[0] ? results[0].totalCount[0].total : 0;

    res.json({
        docs,
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum)
    });

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