// backend/controllers/trajet.controller.js
const Trajet = require('../models/trajet.model');
const LiveTrip = require('../models/LiveTrip.model'); 

// ====================================================================
// --- DÉBUT DE LA CORRECTION : NOUVELLE FONCTION AJOUTÉE ---
// ====================================================================

/**
 * @desc    Récupérer tous les trajets futurs et actifs pour les formulaires admin (ex: colis).
 *          Cette route n'est pas paginée.
 * @route   GET /api/admin/trajets/available-for-colis
 * @access  Admin
 */
exports.getAvailableTrajetsForColis = async (req, res) => {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // Début de la journée actuelle en UTC

    const trajetsDisponibles = await Trajet.find({
      isActive: true, // Doit être un trajet actif
      dateDepart: { $gte: today } // Doit être aujourd'hui ou dans le futur
    }).sort({ dateDepart: 1 }); // Trié par date de départ

    res.json(trajetsDisponibles);

  } catch (err) {
    console.error("Erreur [getAvailableTrajetsForColis]:", err);
    res.status(500).json({ message: "Erreur serveur lors de la récupération des trajets disponibles." });
  }
};

// ====================================================================
// --- FIN DE LA CORRECTION ---
// ====================================================================


/**
 * @desc    Rechercher des trajets pour l'interface publique (avec filtres et pagination)
 * @route   GET /api/public/trajets/search
 * @access  Public
 */
exports.searchTrajets = async (req, res) => {
  try {
    const { villeDepart, villeArrivee, date, compagnie, sortBy = 'date', limit = 6, page = 1 } = req.query;

    let queryFilter = { isActive: true };
    if (villeDepart) queryFilter.villeDepart = { $regex: villeDepart, $options: 'i' };
    if (villeArrivee) queryFilter.villeArrivee = { $regex: villeArrivee, $options: 'i' };
    if (compagnie) queryFilter.compagnie = { $regex: compagnie, $options: 'i' };

    if (date) {
      const startDate = new Date(`${date}T00:00:00.000Z`);
      const endDate = new Date(`${date}T23:59:59.999Z`);
      queryFilter.dateDepart = { $gte: startDate, $lte: endDate };
    } else {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0); 
      queryFilter.dateDepart = { $gte: today };
    }

    let sortOptions = {};
    if (sortBy === 'price_asc') sortOptions.prix = 1;
    else if (sortBy === 'price_desc') sortOptions.prix = -1;
    else sortOptions.dateDepart = 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [docs, total] = await Promise.all([
      Trajet.find(queryFilter)
        .populate('bus', 'numero')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      Trajet.countDocuments(queryFilter)
    ]);
    
    const allCities = await Trajet.distinct('villeDepart');
    const allCompanies = await Trajet.distinct('compagnie');

    res.json({
      docs,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      meta: { allCities, allCompanies }
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
// ==========================================================
// === NOUVELLE FONCTION POUR ANNULER UN TRAJET
// ==========================================================
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

    // On met aussi à jour le LiveTrip associé, s'il existe, pour le marquer comme "Annulé"
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
 * @desc    Récupérer tous les trajets pour le tableau de bord admin
 * @route   GET /api/admin/trajets
 * @access  Admin
 */
exports.getAllTrajetsAdmin = async (req, res) => {
  try {
    const { status } = req.query;
    let dateFilter = {};

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    if (status === 'avenir') {
        dateFilter = { dateDepart: { $gte: today } };
    } else if (status === 'passes') {
        dateFilter = { dateDepart: { $lt: today } };
    }
    
    const trajets = await Trajet.find(dateFilter)
        .populate('bus', 'numero etat')
        .lean();

    // ==========================================================
    // === DÉBUT DE LA CORRECTION
    // ==========================================================
    const trajetsWithLiveTrip = await Promise.all(
        trajets.map(async (trajet) => {
            // On récupère l'objet LiveTrip entier (ou null) pour avoir son ID
            const liveTrip = await LiveTrip.findOne({ trajetId: trajet._id }).lean();
            return {
                ...trajet,
                liveTrip: liveTrip || null // On attache l'objet liveTrip entier
            };
        })
    );
    // ==========================================================
    // === FIN DE LA CORRECTION
    // ==========================================================
    
    trajetsWithLiveTrip.sort((a, b) => {
      const dateA = new Date(a.dateDepart);
      const dateB = new Date(b.dateDepart);
      return status === 'passes' ? dateB - dateA : dateA - dateB;
    });

    res.json(trajetsWithLiveTrip);
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