// backend/controllers/trajet.controller.js
const Trajet = require('../models/trajet.model');
const LiveTrip = require('../models/LiveTrip.model');

// --- FONCTION ENTIÈREMENT MISE À JOUR ET CORRIGÉE ---
exports.getAllTrajetsAdmin = async (req, res) => {
  try {
    const { status = 'avenir', search = '', sortBy = 'date_asc', page = 1, limit = 8 } = req.query;
    const now = new Date();

    let pipeline = [
      { $lookup: { from: 'bus', localField: 'bus', foreignField: '_id', as: 'busInfo' } },
      { $unwind: { path: '$busInfo', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'chauffeurs', localField: 'busInfo._id', foreignField: 'bus', as: 'chauffeurInfo' } },
      { $unwind: { path: '$chauffeurInfo', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'reservations', localField: '_id', foreignField: 'trajet', as: 'reservations' } },
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
      { $lookup: { from: 'livetrips', localField: '_id', foreignField: 'trajetId', as: 'liveTrip' }},
      { $unwind: { path: '$liveTrip', preserveNullAndEmptyArrays: true } },
    ];
    
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

    let statusFilter = {};
    if (status) {
        let filter_part = {};
        const today = new Date(); today.setUTCHours(0,0,0,0)
        switch (status) {
            case 'avenir':
                filter_part = { dateDepart: {$gte: today}, 'liveTrip.status': { $ne: 'En cours' } };
                break;
            case 'encours':
                filter_part = { 'liveTrip.status': 'En cours' };
                break;
            case 'passes':
                filter_part = { $or: [{ isActive: false }, { 'liveTrip.status': { $in: ['Terminé', 'Annulé'] } }, {dateDepart : {$lt: today} }] };
                break;
            case 'tous':
            default:
                break;
        }
        if (Object.keys(filter_part).length > 0) {
            pipeline.push({ $match: filter_part });
        }
    }
    
    let sortStage = {};
    switch (sortBy) {
        case 'price_asc': sortStage = { prix: 1 }; break;
        case 'price_desc': sortStage = { prix: -1 }; break;
        case 'date_desc': sortStage = { dateDepart: -1 }; break;
        case 'date_asc': default: sortStage = { dateDepart: 1 }; break;
    }
    pipeline.push({ $sort: sortStage });

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    pipeline.push({
      $facet: {
        docs: [
          { $skip: skip }, { $limit: limitNum },
          // --- DÉBUT DE LA CORRECTION DANS $project ---
          { 
            $project: {
              _id: 1, villeDepart: 1, villeArrivee: 1, dateDepart: 1, heureDepart: 1, prix: 1, isActive: 1, liveTrip: 1, placesReservees: 1,
              // On reconstruit l'objet 'bus' tel que le frontend l'attend
              bus: {
                $cond: {
                    if: '$busInfo._id',
                    then: {
                        _id: '$busInfo._id',
                        numero: '$busInfo.numero',
                        capacite: '$busInfo.capacite'
                    },
                    else: null
                }
              },
              // On reconstruit l'objet 'chauffeur'
              chauffeur: {
                 $cond: {
                    if: '$chauffeurInfo._id',
                    then: {
                        _id: '$chauffeurInfo._id',
                        prenom: '$chauffeurInfo.prenom',
                        nom: '$chauffeurInfo.nom'
                    },
                    else: null
                }
              }
            }
          }
          // --- FIN DE LA CORRECTION DANS $project ---
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


// Le reste des fonctions dans ce fichier n'a pas besoin de changer.
// getTrajetByIdPublic, createTrajet, etc.
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

exports.createTrajet = async (req, res) => {
  try {
    const newTrajet = new Trajet(req.body);
    const savedTrajet = await newTrajet.save();
    res.status(201).json(savedTrajet);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

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