// backend/controllers/trajet.controller.js
const Trajet = require('../models/trajet.model');
const LiveTrip = require('../models/LiveTrip.model'); 

/**
 * @desc    Rechercher des trajets pour l'interface publique (avec filtres et pagination)
 * @route   GET /api/public/trajets/search
 * @access  Public
 */
exports.searchTrajets = async (req, res) => {
  try {
    const { villeDepart, villeArrivee, date, sortBy = 'date', limit = 6, page = 1 } = req.query;
    
    // --- DÉBUT DE LA NOUVELLE LOGIQUE D'AGRÉGATION ---

    // Étape 1 : On commence le pipeline d'agrégation
    let pipeline = [];
    
    // Étape 2 : On combine la date et l'heure en un seul champ de type Date
    // MongoDB peut ensuite comparer ce champ correctement
    pipeline.push({
      $addFields: {
        fullDepartureDate: {
          $dateFromString: {
            dateString: {
              $concat: [
                { $dateToString: { format: "%Y-%m-%d", date: "$dateDepart" } },
                "T",
                "$heureDepart",
                ":00.000Z" // On suppose que l'heure est en UTC
              ]
            }
          }
        }
      }
    });

    // Étape 3 : On construit le filtre ($match)
    let matchFilter = { isActive: true };

    if (date) {
      // Si une date est spécifiée, on filtre sur cette journée
      const startDate = new Date(`${date}T00:00:00.000Z`);
      const endDate = new Date(`${date}T23:59:59.999Z`);
      matchFilter.fullDepartureDate = { $gte: startDate, $lte: endDate };
    } else {
      // Si aucune date n'est spécifiée, on filtre pour avoir tous les trajets futurs
      matchFilter.fullDepartureDate = { $gte: new Date() };
    }

    // On ajoute les filtres de ville si présents
    if (villeDepart) matchFilter.villeDepart = { $regex: villeDepart, $options: 'i' };
    if (villeArrivee) matchFilter.villeArrivee = { $regex: villeArrivee, $options: 'i' };

    pipeline.push({ $match: matchFilter });
    
    // Étape 4 : On construit le tri
    let sortOptions = {};
    if (sortBy === 'price_asc') sortOptions.prix = 1;
    else if (sortBy === 'price_desc') sortOptions.prix = -1;
    else sortOptions.fullDepartureDate = 1; // On trie sur notre nouveau champ

    pipeline.push({ $sort: sortOptions });

    // Étape 5 : On gère la pagination avec $facet
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const facetPipeline = [
      ...pipeline,
      {
        $facet: {
          docs: [
            { $skip: skip },
            { $limit: limitNum },
            // On peuple le bus associé
            { $lookup: { from: 'bus', localField: 'bus', foreignField: '_id', as: 'bus' } },
            { $unwind: { path: '$bus', preserveNullAndEmptyArrays: true } }
          ],
          totalCount: [
            { $count: 'total' }
          ]
        }
      }
    ];

    // On exécute l'agrégation
    const results = await Trajet.aggregate(facetPipeline);
    const docs = results[0].docs;
    const total = results[0].totalCount[0] ? results[0].totalCount[0].total : 0;
    
    // On récupère les métadonnées (villes) en parallèle
    const allCities = await Trajet.distinct('villeDepart');

    res.json({
      docs,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      meta: { allCities }
    });

  } catch (err) {
    console.error("Erreur [searchTrajets]:", err);
    res.status(500).json({ message: "Erreur serveur lors de la recherche." });
  }
};


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
 * @desc    Récupérer tous les trajets pour l'admin, avec filtres, recherche et tri.
 * @route   GET /api/admin/trajets
 * @access  Admin
 */
exports.getAllTrajetsAdmin = async (req, res) => {
  try {
    const { status = 'avenir', search = '', sortBy = 'date_asc', page = 1, limit = 8 } = req.query;
    const now = new Date();

    let pipeline = [
      // 1. Jointure avec la collection 'bus'
      { $lookup: { from: 'bus', localField: 'bus', foreignField: '_id', as: 'busInfo' } },
      { $unwind: { path: '$busInfo', preserveNullAndEmptyArrays: true } },

      // 2. Jointure avec 'chauffeurs' pour trouver le chauffeur du bus
      {
        $lookup: {
          from: 'chauffeurs',
          localField: 'busInfo._id',
          foreignField: 'bus',
          as: 'chauffeurInfo'
        }
      },
      { $unwind: { path: '$chauffeurInfo', preserveNullAndEmptyArrays: true } },
      
      // 3. Jointure avec 'reservations' pour calculer les places
      { $lookup: { from: 'reservations', localField: '_id', foreignField: 'trajet', as: 'reservations' } },

      // 4. Calculer le nombre de places réservées
      {
        $addFields: {
          placesReservees: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$reservations",
                    as: "res",
                    cond: { $eq: ["$$res.statut", "confirmée"] }
                  }
                },
                as: "reservation",
                in: "$$reservation.placesReservees"
              }
            }
          }
        }
      },

      // 5. Jointure avec 'livetrips' pour le statut du voyage
      { $lookup: { from: 'livetrips', localField: '_id', foreignField: 'trajetId', as: 'liveTrip' }},
      { $unwind: { path: '$liveTrip', preserveNullAndEmptyArrays: true } },
    ];
    
    // 6. Filtrer par recherche textuelle si nécessaire
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { villeDepart: { $regex: search, $options: 'i' } },
            { villeArrivee: { $regex: search, $options: 'i' } },
          ]
        }
      });
    }

    // 7. Filtrer par statut (avenir, en cours, etc.)
    let statusFilter = {};
    switch (status) {
      case 'avenir':
        statusFilter = { fullDepartureDate: { $gte: now }, 'liveTrip.status': { $ne: 'En cours' } };
        break;
      case 'encours':
        statusFilter = { 'liveTrip.status': 'En cours' };
        break;
      case 'passes':
        statusFilter = { $or: [{ isActive: false }, { 'liveTrip.status': { $in: ['Terminé', 'Annulé'] } }] };
        break;
      case 'tous':
      default:
        break;
    }
    
    if (Object.keys(statusFilter).length > 0) {
      // On combine la date et l'heure pour le filtre 'avenir'
      if(statusFilter.fullDepartureDate){
        pipeline.unshift({
          $addFields: {
            fullDepartureDate: {
              $dateFromString: {
                dateString: { $concat: [{ $dateToString: { format: "%Y-%m-%d", date: "$dateDepart" } }, "T", "$heureDepart", ":00.000Z" ] }
              }
            }
          }
        });
      }
      pipeline.push({ $match: statusFilter });
    }
    
    // 8. Trier les résultats
    let sortStage = {};
    switch (sortBy) {
        case 'price_asc': sortStage = { prix: 1 }; break;
        case 'price_desc': sortStage = { prix: -1 }; break;
        case 'date_desc': sortStage = { dateDepart: -1 }; break;
        case 'date_asc': default: sortStage = { dateDepart: 1 }; break;
    }
    pipeline.push({ $sort: sortStage });

    // 9. Pagination
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    pipeline.push({
      $facet: {
        docs: [
          { $skip: skip }, { $limit: limitNum },
          { $project: {
              _id: 1, villeDepart: 1, villeArrivee: 1, dateDepart: 1, heureDepart: 1, prix: 1, isActive: 1, liveTrip: 1,
              'bus.numero': '$busInfo.numero',
              'bus.capacite': '$busInfo.capacite',
              'chauffeur.prenom': '$chauffeurInfo.prenom',
              'chauffeur.nom': '$chauffeurInfo.nom',
              placesReservees: 1,
            }
          }
        ],
        totalCount: [{ $count: 'total' }]
      }
    });

    const results = await Trajet.aggregate(pipeline);
    const docs = results[0].docs;
    const total = results[0].totalCount[0] ? results[0].totalCount[0].total : 0;
    
    res.json({
        docs,
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum)
    });
  } catch (err) {
    console.error("Erreur getAllTrajetsAdmin:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @desc    Récupérer tous les trajets futurs et actifs pour les formulaires admin.
 * @route   GET /api/admin/trajets/available-for-colis
 * @access  Admin
 */
exports.getAvailableTrajetsForColis = async (req, res) => {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const trajetsDisponibles = await Trajet.find({
      isActive: true,
      dateDepart: { $gte: today }
    }).sort({ dateDepart: 1 });

    res.json(trajetsDisponibles);

  } catch (err) {
    console.error("Erreur [getAvailableTrajetsForColis]:", err);
    res.status(500).json({ message: "Erreur serveur lors de la récupération des trajets disponibles." });
  }
};

/**
 * @desc    Annuler un trajet (le rend inactif et met à jour le LiveTrip si besoin)
 * @route   PUT /api/admin/trajets/:id/cancel
 * @access  Admin
 */
exports.cancelTrajet = async (req, res) => {
  try {
    const trajet = await Trajet.findByIdAndUpdate(
      req.params.id, 
      { isActive: false }, 
      { new: true }
    );

    if (!trajet) {
      return res.status(404).json({ message: "Trajet non trouvé" });
    }

    await LiveTrip.findOneAndUpdate(
        { trajetId: req.params.id },
        { status: 'Annulé' }
    );

    res.json({ message: "Trajet annulé avec succès.", trajet });
  } catch (err) {
    console.error("Erreur cancelTrajet:", err);
    res.status(500).json({ message: "Erreur serveur lors de l'annulation du trajet." });
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