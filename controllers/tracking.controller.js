// backend/controllers/tracking.controller.js
const mongoose = require('mongoose'); // <-- LA LIGNE MANQUANTE À AJOUTER
const Reservation = require('../models/reservation.model');
const LiveTrip = require('../models/LiveTrip.model');
const Trajet = require('../models/trajet.model');

/**
 * @desc    Pour un admin, démarrer le suivi en direct d'un voyage
 * @route   POST /api/tracking/start-trip
 * @access  Admin
 */
exports.startTrip = async (req, res) => {
    try {
        const { trajetId } = req.body;
        if (!trajetId) {
            return res.status(400).json({ message: "L'ID du trajet est requis." });
        }
        
        // S'assurer que l'ID est bien un ObjectId valide
        const trajetObjectId = new mongoose.Types.ObjectId(trajetId);

        const trajet = await Trajet.findById(trajetObjectId).populate('bus');
        if (!trajet) return res.status(404).json({ message: "Trajet non trouvé" });
        if (!trajet.bus) return res.status(400).json({ message: "Aucun bus n'est assigné à ce trajet." });

        // Chercher si un LiveTrip existe déjà pour ce trajet
        let liveTrip = await LiveTrip.findOne({ trajetId: trajetObjectId });

        if (liveTrip) {
            // S'il existe, on le met juste à jour
            liveTrip.status = 'En cours';
            liveTrip.lastUpdated = new Date();
        } else {
            // Sinon, on en crée un nouveau
            liveTrip = new LiveTrip({
                trajetId: trajet._id,
                busId: trajet.bus._id,
                originCityName: trajet.villeDepart,
                destinationCityName: trajet.villeArrivee,
                departureDateTime: trajet.dateDepart,
                status: 'En cours',
            });
        }
        
        await liveTrip.save();
        console.log(`Voyage pour le trajet ${trajetId} démarré avec succès.`);
        res.status(200).json({ message: "Le voyage a démarré.", liveTrip });

    } catch (err) {
        console.error("Erreur startTrip:", err);
        res.status(500).json({ message: err.message });
    }
};

/**
 * @desc    Mettre à jour la position GPS d'un bus pour un voyage en direct
 * @route   POST /api/tracking/live/:liveTripId/update-position
 * @access  Admin (ou un appareil GPS autorisé)
 */
exports.updateBusPosition = async (req, res) => {
    try {
        const { liveTripId } = req.params;
        const { lat, lng } = req.body;
        if (typeof lat !== 'number' || typeof lng !== 'number') {
            return res.status(400).json({ message: "Les coordonnées lat et lng sont requises et doivent être des nombres." });
        }

        const liveTrip = await LiveTrip.findByIdAndUpdate(
            liveTripId,
            { 
                currentPosition: { lat, lng },
                lastUpdated: new Date()
            },
            { new: true }
        );

        if (!liveTrip) return res.status(404).json({ message: "Voyage en cours non trouvé." });
        
        res.status(200).json(liveTrip);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * @desc    Pour le client, récupère les informations de son prochain voyage confirmé
 * @route   GET /api/tracking/my-next-trip
 * @access  Privé (client connecté)
 */
exports.getMyNextTrip = async (req, res) => {
    try {
        const now = new Date();

        const allConfirmedReservations = await Reservation.find({
            client: req.user._id,
            statut: 'confirmée',
        }).populate('trajet');

        if (!allConfirmedReservations || allConfirmedReservations.length === 0) {
            return res.json({ message: "Vous n'avez aucune réservation confirmée." });
        }

        const futureReservations = allConfirmedReservations.filter(r => {
            if (!r.trajet) return false;
            const departureDateTime = new Date(`${new Date(r.trajet.dateDepart).toISOString().split('T')[0]}T${r.trajet.heureDepart}:00`);
            return departureDateTime >= now;
        });

        if (futureReservations.length === 0) {
            return res.json({ message: "Vous n'avez aucun voyage à venir." });
        }

        futureReservations.sort((a, b) => {
            const dateA = new Date(`${new Date(a.trajet.dateDepart).toISOString().split('T')[0]}T${a.trajet.heureDepart}:00`);
            const dateB = new Date(`${new Date(b.trajet.dateDepart).toISOString().split('T')[0]}T${b.trajet.heureDepart}:00`);
            return dateA - dateB;
        });
        
        const nextReservation = futureReservations[0];
        const liveTrip = await LiveTrip.findOne({ trajetId: nextReservation.trajet._id });

        res.json({
            reservation: nextReservation,
            liveTrip: liveTrip || null,
        });

    } catch (err) {
        console.error("Erreur getMyNextTrip:", err);
        res.status(500).json({ message: err.message });
    }
};

/**
 * @desc    Récupérer les détails d'un voyage en cours par son ID
 * @route   GET /api/tracking/live/:liveTripId
 * @access  Privé (client connecté)
 */
exports.getLiveTripById = async (req, res) => {
    try {
        const { liveTripId } = req.params;
        const liveTrip = await LiveTrip.findById(liveTripId);

        if (!liveTrip) {
            return res.status(404).json({ message: "Voyage en direct non trouvé." });
        }

        // Optionnel : Vérification de sécurité pour s'assurer que le client a bien une réservation pour ce trajet
        const hasReservation = await Reservation.findOne({
            client: req.user._id,
            trajetId: liveTrip.trajetId,
            statut: 'confirmée'
        });

        if (!hasReservation && req.user.role !== 'admin') {
            return res.status(403).json({ message: "Accès non autorisé à ce suivi." });
        }

        res.json(liveTrip);
    } catch (err) {
        console.error("Erreur getLiveTripById:", err);
        res.status(500).json({ message: "Erreur serveur." });
    }
};