// backend/controllers/tracking.controller.js
const Reservation = require('../models/reservation.model');
const LiveTrip = require('../models/LiveTrip.model');
const Trajet = require('../models/trajet.model');

// Fonction pour démarrer un trajet (pourrait être appelée par un admin ou un cronjob)
// Pour la simplicité, on va créer une route pour le faire manuellement.
exports.startTrip = async (req, res) => {
    try {
        const { trajetId } = req.body;
        const trajet = await Trajet.findById(trajetId).populate('bus');
        if (!trajet) return res.status(404).json({ message: "Trajet non trouvé" });
        if (!trajet.bus) return res.status(400).json({ message: "Aucun bus n'est assigné à ce trajet." });

        // Vérifier si un LiveTrip existe déjà pour ce trajet
        let liveTrip = await LiveTrip.findOne({ trajetId });

        if (liveTrip) {
            // Mettre à jour le statut s'il existe déjà
            liveTrip.status = 'En cours';
        } else {
            // Créer un nouveau LiveTrip
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
        res.status(200).json({ message: "Le voyage a démarré.", liveTrip });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Fonction pour mettre à jour la position GPS du bus
// Un vrai système aurait une app GPS qui envoie des requêtes à cette route.
// Ici, on peut la simuler.
exports.updateBusPosition = async (req, res) => {
    try {
        const { liveTripId } = req.params;
        const { lat, lng } = req.body;

        const liveTrip = await LiveTrip.findByIdAndUpdate(
            liveTripId,
            { 
                currentPosition: { lat, lng },
                lastUpdated: new Date()
            },
            { new: true }
        );

        if (!liveTrip) return res.status(404).json({ message: "Voyage en cours non trouvé." });

        // TODO: Envoyer des notifications aux clients via WebSocket (étape avancée)

        res.status(200).json(liveTrip);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Fonction pour le client pour obtenir les infos de son prochain voyage
exports.getMyNextTrip = async (req, res) => {
    try {
        // Trouver la réservation confirmée la plus proche dans le futur pour ce client
        const nextReservation = await Reservation.findOne({
            client: req.user._id,
            statut: 'confirmée',
        }).populate({
            path: 'trajet',
            match: { dateDepart: { $gte: new Date() } },
        }).sort({ 'trajet.dateDepart': 1 });

        if (!nextReservation || !nextReservation.trajet) {
            return res.json({ message: "Vous n'avez aucun voyage à venir." });
        }

        // Vérifier s'il y a un LiveTrip associé
        const liveTrip = await LiveTrip.findOne({ trajetId: nextReservation.trajet._id });

        res.json({
            reservation: nextReservation,
            liveTrip: liveTrip || null,
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};