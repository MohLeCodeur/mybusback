// backend/controllers/trajet.controller.js
const Trajet = require('../models/trajet.model');
const LiveTrip = require('../models/LiveTrip.model'); 
const mongoose = require('mongoose');

// ====================================================================
// --- FONCTION ENTIÈREMENT REVUE ET CORRIGÉE AVEC LOGIQUE DE STATUT ROBUSTE ---
// ====================================================================
/**
 * @desc    Récupérer tous les trajets pour l'admin, avec filtres, recherche et tri.
 * @route   GET /api/admin/trajets
 * @access  Admin
 */
exports.getAllTrajetsAdmin = async (req, res) => {
  try {
    const { status = 'avenir', search = '', sortBy = 'date_asc', page = 1, limit = 8 } = req.query;
    const now = new Date();

    // 1. Appliquer le filtre de recherche textuelle directement dans la requête DB
    let searchFilter = {};
    if (search) {
        searchFilter = {
            $or: [
                { villeDepart: { $regex: search, $options: 'i' } },
                { villeArrivee: { $regex: search, $options: 'i' } },
                { compagnie: { $regex: search, $options: 'i' } }
            ]
        };
    }
    
    const trajetsCorrespondants = await Trajet.find(searchFilter).populate('bus', 'numero etat').lean();
    const trajetIds = trajetsCorrespondants.map(t => t._id);
    
    const liveTrips = await LiveTrip.find({ trajetId: { $in: trajetIds } }).lean();
    const liveTripMap = new Map(liveTrips.map(lt => [lt.trajetId.toString(), lt]));

    // 2. Filtrer en mémoire en fonction du statut réel et de la date
    let filteredTrajets = [];
    trajetsCorrespondants.forEach(trajet => {
        const liveTrip = liveTripMap.get(trajet._id.toString());
        const departureDateTime = new Date(`${new Date(trajet.dateDepart).toISOString().split('T')[0]}T${trajet.heureDepart}:00Z`);
        const trajetWithLiveTrip = { ...trajet, liveTrip };
        
        let conditionMet = false;
        switch (status) {
            case 'avenir':
                // "À venir" = L'heure de départ est dans le futur ET le voyage n'est pas encore 'En cours'
                if (departureDateTime >= now && (!liveTrip || liveTrip.status === 'À venir')) {
                    conditionMet = true;
                }
                break;
            case 'encours':
                // "En cours" = Le statut LiveTrip est explicitement 'En cours'
                if (liveTrip && liveTrip.status === 'En cours') {
                    conditionMet = true;
                }
                break;
            case 'passes':
                // "Passé" = Le voyage est terminé, annulé, OU l'heure de départ est passée sans qu'il soit démarré
                if (
                    !trajet.isActive ||
                    (liveTrip && ['Terminé', 'Annulé'].includes(liveTrip.status)) ||
                    (departureDateTime < now && (!liveTrip || liveTrip.status !== 'En cours'))
                ) {
                    conditionMet = true;
                }
                break;
            case 'tous':
            default:
                conditionMet = true;
                break;
        }

        if (conditionMet) {
            filteredTrajets.push(trajetWithLiveTrip);
        }
    });
    
    // 3. Appliquer le tri sur la liste filtrée
    filteredTrajets.sort((a, b) => {
        const dateA = new Date(a.dateDepart);
        const dateB = new Date(b.dateDepart);
        switch (sortBy) {
            case 'price_asc': return a.prix - b.prix;
            case 'price_desc': return b.prix - a.prix;
            case 'date_desc': return dateB - dateA;
            case 'date_asc':
            default: return dateA - dateB;
        }
    });

    // 4. Appliquer la pagination sur le résultat final
    const total = filteredTrajets.length;
    const paginatedTrajets = filteredTrajets.slice((parseInt(page) - 1) * parseInt(limit), parseInt(page) * parseInt(limit));

    res.json({
        docs: paginatedTrajets,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
    });

  } catch (err) {
    console.error("Erreur getAllTrajetsAdmin:", err);
    res.status(500).json({ message: err.message });
  }
};
// ====================================================================
// --- FIN DE LA CORRECTION ---
// ====================================================================

// Le reste des fonctions (create, update, delete, etc.) est correct et reste inchangé.
// ...

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