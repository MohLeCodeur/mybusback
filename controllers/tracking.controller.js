// backend/controllers/tracking.controller.js
const Reservation = require('../models/reservation.model');
const LiveTrip = require('../models/LiveTrip.model');
const Trajet = require('../models/trajet.model');

/**
 * @desc    Pour le client, récupère les informations de son prochain voyage confirmé
 * @route   GET /api/tracking/my-next-trip
 * @access  Privé (client connecté)
 */
exports.getMyNextTrip = async (req, res) => {
    try {
        const now = new Date(); // Date et heure actuelles

        // 1. Trouver toutes les réservations confirmées pour ce client
        const allConfirmedReservations = await Reservation.find({
            client: req.user._id,
            statut: 'confirmée',
        }).populate('trajet');

        if (!allConfirmedReservations || allConfirmedReservations.length === 0) {
            return res.json({ message: "Vous n'avez aucune réservation confirmée." });
        }

        // --- LOGIQUE CORRIGÉE ---
        // 2. Filtrer pour ne garder que les trajets dont l'heure de départ n'est pas encore passée
        const futureReservations = allConfirmedReservations.filter(res => {
            if (!res.trajet) return false;

            // On construit la date de départ complète en combinant la date et l'heure du trajet
            const departureDateStr = new Date(res.trajet.dateDepart).toISOString().split('T')[0];
            const departureDateTime = new Date(`${departureDateStr}T${res.trajet.heureDepart}:00`);
            
            // On compare cette date complète avec la date et l'heure actuelles
            return departureDateTime >= now;
        });
        // -----------------------

        if (futureReservations.length === 0) {
            return res.json({ message: "Vous n'avez aucun voyage à venir." });
        }

        // 3. Trier pour trouver le voyage le plus proche dans le temps
        futureReservations.sort((a, b) => {
            const dateA = new Date(`${new Date(a.trajet.dateDepart).toISOString().split('T')[0]}T${a.trajet.heureDepart}:00`);
            const dateB = new Date(`${new Date(b.trajet.dateDepart).toISOString().split('T')[0]}T${b.trajet.heureDepart}:00`);
            return dateA - dateB;
        });
        
        const nextReservation = futureReservations[0];

        // 4. Vérifier s'il y a un LiveTrip associé à ce prochain trajet
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


// Les autres fonctions (startTrip, updateBusPosition) restent les mêmes.
exports.startTrip = async (req, res) => {
    try {
        const { trajetId } = req.body;
        const trajet = await Trajet.findById(trajetId).populate('bus');
        if (!trajet) return res.status(404).json({ message: "Trajet non trouvé" });
        if (!trajet.bus) return res.status(400).json({ message: "Aucun bus n'est assigné à ce trajet." });
        let liveTrip = await LiveTrip.findOne({ trajetId });
        if (liveTrip) {
            liveTrip.status = 'En cours';
        } else {
            liveTrip = new LiveTrip({
                trajetId: trajet._id, busId: trajet.bus._id,
                originCityName: trajet.villeDepart, destinationCityName: trajet.villeArrivee,
                departureDateTime: trajet.dateDepart, status: 'En cours',
            });
        }
        await liveTrip.save();
        res.status(200).json({ message: "Le voyage a démarré.", liveTrip });
    } catch (err) { res.status(500).json({ message: err.message }); }
};
exports.updateBusPosition = async (req, res) => {
    try {
        const { liveTripId } = req.params;
        const { lat, lng } = req.body;
        const liveTrip = await LiveTrip.findByIdAndUpdate( liveTripId, { currentPosition: { lat, lng }, lastUpdated: new Date() }, { new: true });
        if (!liveTrip) return res.status(404).json({ message: "Voyage en cours non trouvé." });
        res.status(200).json(liveTrip);
    } catch (err) { res.status(500).json({ message: err.message }); }
};