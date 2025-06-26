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

    // --- NOUVELLE LOGIQUE DE TRI ---
    let sortOptions = {};
    if (sortBy === 'price_asc') sortOptions.prix = 1;
    else if (sortBy === 'price_desc') sortOptions.prix = -1;
    else sortOptions.dateDepart = 1; // Tri par défaut
    // ----------------------------

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [docs, total] = await Promise.all([
      Trajet.find(queryFilter)
        .populate('bus', 'numero')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      Trajet.countDocuments(queryFilter)
    ]);
    
    // Récupérer toutes les villes et compagnies pour les filtres
    const allCities = await Trajet.distinct('villeDepart');
    const allCompanies = await Trajet.distinct('compagnie');

    res.json({
      docs,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      meta: { allCities, allCompanies } // On envoie les métadonnées pour les filtres
    });

  } catch (err) {
    console.error("Erreur [searchTrajets]:", err);
    res.status(500).json({ message: "Erreur serveur lors de la recherche." });
  }
};

// ==============================================================
// Les autres fonctions restent inchangées
// ==============================================================

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
    let queryFilter = {};

    // ==========================================================
    // === DÉBUT DE LA LOGIQUE DE FILTRAGE MODIFIÉE
    // ==========================================================
    if (status === 'avenir') {
        // "À venir" sont tous les trajets qui ne sont ni "En cours" ni "Terminé"
        queryFilter.etatVoyage = 'Non commencé';
    } else if (status === 'passes') {
        // "Passés" sont uniquement les trajets marqués comme "Terminé"
        queryFilter.etatVoyage = 'Terminé';
    }
    // Si status est "tous" ou autre, on récupère tout
    // ==========================================================
    // === FIN DE LA LOGIQUE DE FILTRAGE
    // ==========================================================
    
    const trajets = await Trajet.find(queryFilter)
        .populate('bus', 'numero etat')
        .lean();

    const trajetsWithLiveStatus = await Promise.all(
        trajets.map(async (trajet) => {
            const liveTrip = await LiveTrip.findOne({ trajetId: trajet._id }, 'status').lean();
            return {
                ...trajet,
                liveStatus: liveTrip?.status || null
            };
        })
    );
    
    trajetsWithLiveStatus.sort((a, b) => {
      const dateA = new Date(a.dateDepart);
      const dateB = new Date(b.dateDepart);
      return status === 'passes' ? dateB - dateA : dateA - dateB;
    });

    res.json(trajetsWithLiveStatus);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ==========================================================
// === NOUVELLES FONCTIONS POUR LA GESTION MANUELLE
// ==========================================================

/**
 * @desc    Pour un admin, démarrer le suivi d'un voyage.
 * @route   POST /api/admin/trajets/:id/demarrer
 * @access  Admin
 */
exports.demarrerTrajet = async (req, res) => {
    try {
        const { id } = req.params;
        const trajet = await Trajet.findById(id).populate('bus');

        if (!trajet) return res.status(404).json({ message: "Trajet non trouvé" });
        if (trajet.etatVoyage !== 'Non commencé') return res.status(400).json({ message: `Le voyage est déjà "${trajet.etatVoyage}"`});
        if (!trajet.bus) return res.status(400).json({ message: "Aucun bus n'est assigné à ce trajet." });
        if (!trajet.coordsDepart?.lat || !trajet.coordsArrivee?.lat) {
            return res.status(400).json({ message: "Les coordonnées GPS sont manquantes." });
        }

        let liveTrip = await LiveTrip.findOne({ trajetId: id });
        if (!liveTrip) {
            const routeData = await calculateORS_Route(trajet.coordsDepart, trajet.coordsArrivee);
            liveTrip = new LiveTrip({
                trajetId: trajet._id, busId: trajet.bus._id,
                originCityName: trajet.villeDepart, destinationCityName: trajet.villeArrivee,
                departureDateTime: trajet.dateDepart,
                routeGeoJSON: routeData.geojson,
                routeInstructions: routeData.instructions,
                routeSummary: routeData.summary,
                currentPosition: trajet.coordsDepart
            });
        }
        
        liveTrip.status = 'En cours';
        liveTrip.lastUpdated = new Date();
        await liveTrip.save();
        
        // Mettre à jour l'état du trajet principal
        trajet.etatVoyage = 'En cours';
        await trajet.save();

        // Logique de notification
        const reservations = await Reservation.find({ trajet: trajet._id, statut: 'confirmée' });
        reservations.forEach(r => {
            const recipientSocketId = req.onlineUsers[r.client.toString()];
            if (recipientSocketId) {
                req.io.to(recipientSocketId).emit("getNotification", {
                    title: "Votre voyage a commencé !",
                    message: `Le suivi pour le trajet ${trajet.villeDepart} → ${trajet.villeArrivee} est actif.`,
                    link: `/tracking/map/${liveTrip._id}`
                });
            }
        });
        
        res.status(200).json({ message: "Le voyage a démarré avec succès.", trajet });
    } catch (err) {
        console.error("Erreur demarrerTrajet:", err.message);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
};

/**
 * @desc    Marquer un voyage comme terminé.
 * @route   POST /api/admin/trajets/:id/terminer
 * @access  Admin
 */
exports.terminerTrajet = async (req, res) => {
    try {
        const trajet = await Trajet.findByIdAndUpdate(req.params.id, { etatVoyage: 'Terminé' }, { new: true });
        if (!trajet) return res.status(404).json({ message: "Trajet non trouvé." });

        await LiveTrip.findOneAndUpdate({ trajetId: req.params.id }, { status: 'Terminé' });

        res.json({ message: "Voyage marqué comme terminé.", trajet });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * @desc    Notifier les passagers d'un retard.
 * @route   POST /api/admin/trajets/:id/notifier-retard
 * @access  Admin
 */
exports.notifierRetard = async (req, res) => {
    try {
        const trajet = await Trajet.findById(req.params.id);
        if (!trajet) return res.status(404).json({ message: "Trajet non trouvé." });

        const reservations = await Reservation.find({ trajet: trajet._id, statut: 'confirmée' });
        let notificationCount = 0;

        reservations.forEach(r => {
            const recipientSocketId = req.onlineUsers[r.client.toString()];
            if (recipientSocketId) {
                req.io.to(recipientSocketId).emit("getNotification", {
                    title: "Information sur votre voyage",
                    message: `Le départ du trajet ${trajet.villeDepart} → ${trajet.villeArrivee} est retardé. Nous vous remercions de votre patience.`,
                    link: `/dashboard` 
                });
                notificationCount++;
            }
        });

        res.json({ message: `${notificationCount} passager(s) ont été notifiés du retard.` });
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
 * @access  AdmingetAllTrajetsAdmi
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