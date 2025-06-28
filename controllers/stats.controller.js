// backend/controllers/stats.controller.js
const Reservation = require("../models/reservation.model");
const Colis = require("../models/colis.model");
const Client = require("../models/client.model");
const Bus = require("../models/bus.model");
const Chauffeur = require("../models/chauffeur.model");
// Pas besoin de 'Trajet' pour le dashboard overview.

// ====================================================================
// --- DÉBUT DE LA CORRECTION : LOGIQUE ROBUSTIFIÉE ---
// ====================================================================

/**
 * @desc    Récupérer les statistiques globales pour le tableau de bord admin.
 * @route   GET /api/admin/stats/overview
 * @access  Admin
 */
exports.getOverviewStats = async (req, res) => {
    try {
        // Ajout d'une vérification pour s'assurer que les modèles sont bien chargés.
        // Si un modèle est manquant, cela lèvera une erreur claire.
        if (!Bus || !Chauffeur || !Colis || !Reservation) {
            throw new Error("Un ou plusieurs modèles de données n'ont pas pu être chargés.");
        }

        // On lance toutes les requêtes de comptage en parallèle pour une efficacité maximale
        const [busCount, chauffeurCount, colisCount, reservationCount] = await Promise.all([
            Bus.countDocuments(),
            Chauffeur.countDocuments(),
            Colis.countDocuments(),
            Reservation.countDocuments() // On peut compter toutes les réservations ici
        ]);

        res.json({
            busCount,
            chauffeurCount,
            colisCount,
            reservationCount
        });

    } catch (err) {
        // On log l'erreur côté serveur pour un débogage facile
        console.error("ERREUR DANS getOverviewStats:", err.message);
        console.error(err.stack); // Affiche la pile d'appels pour voir d'où vient l'erreur
        
        // On renvoie une erreur 500 claire au frontend
        res.status(500).json({ message: "Erreur serveur critique lors de la récupération des statistiques du tableau de bord." });
    }
};

// ====================================================================
// --- FIN DE LA CORRECTION ---
// ====================================================================


// Les autres fonctions (getRevenus, getPerformanceInsights) restent inchangées.
// Elles sont correctes.
exports.getRevenus = async (req, res) => {
    try {
        const periode = req.query.periode || 'weekly'; // 'daily', 'weekly', 'monthly', 'yearly'
        const now = new Date();
        let startDate;

        switch (periode) {
            case 'daily':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'monthly':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                break;
            case 'yearly':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            case 'weekly':
            default:
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
                break;
        }
        startDate.setHours(0, 0, 0, 0);

        const dateFilter = { $gte: startDate };

        const reservationsPromise = Reservation.aggregate([
            { $match: { statut: 'confirmée', dateReservation: dateFilter } },
            { $lookup: { from: "trajets", localField: "trajet", foreignField: "_id", as: "trajetInfo" } },
            { $unwind: "$trajetInfo" },
            { $project: { date: "$dateReservation", revenue: { $multiply: ["$trajetInfo.prix", "$placesReservees"] }, count: 1 } }
        ]);
        const colisPromise = Colis.aggregate([
            { $match: { date_enregistrement: dateFilter } },
            { $project: { date: "$date_enregistrement", revenue: "$prix", count: 1 } }
        ]);
        const newUsersPromise = Client.countDocuments({ createdAt: dateFilter });

        const [reservationData, colisData, newUsersCount] = await Promise.all([reservationsPromise, colisPromise, newUsersPromise]);

        const totalRevenueBillets = reservationData.reduce((sum, item) => sum + item.revenue, 0);
        const totalRevenueColis = colisData.reduce((sum, item) => sum + item.revenue, 0);
        const summary = {
            totalRevenue: totalRevenueBillets + totalRevenueColis,
            totalRevenueBillets,
            totalRevenueColis,
            totalReservations: reservationData.length,
            totalColis: colisData.length,
            newUsersCount
        };

        const allTransactions = [
            ...reservationData.map(r => ({ ...r, type: 'billets' })),
            ...colisData.map(c => ({ ...c, type: 'colis' }))
        ];

        const groupedForChart = allTransactions.reduce((acc, item) => {
            const date = new Date(item.date);
            let key;
            if (periode === 'yearly') {
                key = date.toLocaleString('fr-FR', { month: 'short' });
            } else {
                key = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
            }
            
            if (!acc[key]) acc[key] = { label: key, dateObj: date, billets: 0, colis: 0 };
            acc[key][item.type] += item.revenue;
            
            return acc;
        }, {});
        
        const chartData = Object.values(groupedForChart).sort((a,b) => a.dateObj - b.dateObj);

        return res.json({ summary, chartData });
        
    } catch (err) {
        console.error("Erreur de calcul des statistiques de revenus:", err);
        return res.status(500).json({ message: "Erreur de calcul des statistiques de revenus." });
    }
};

exports.getPerformanceInsights = async (req, res) => {
    try {
        const periode = req.query.periode || 'monthly';
        const now = new Date();
        let startDate;

        switch (periode) {
            case 'daily': startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
            case 'yearly': startDate = new Date(now.getFullYear(), 0, 1); break;
            case 'weekly': startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6); break;
            case 'monthly': default: startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()); break;
        }
        startDate.setHours(0, 0, 0, 0);
        const dateFilter = { $gte: startDate };
        const topRoutesPromise = Reservation.aggregate([
            { $match: { statut: 'confirmée', dateReservation: dateFilter } },
            { $lookup: { from: 'trajets', localField: 'trajet', foreignField: '_id', as: 'trajetInfo' } },
            { $unwind: '$trajetInfo' },
            { $group: {
                _id: '$trajet',
                villeDepart: { $first: '$trajetInfo.villeDepart' },
                villeArrivee: { $first: '$trajetInfo.villeArrivee' },
                totalRevenue: { $sum: { $multiply: ['$trajetInfo.prix', '$placesReservees'] } },
                reservationCount: { $sum: 1 }
            }},
            { $sort: { totalRevenue: -1 } },
            { $limit: 5 },
            { $project: { _id: 0, route: { $concat: ['$villeDepart', ' → ', '$villeArrivee'] }, totalRevenue: 1, reservationCount: 1 } }
        ]);

        // <--- DÉBUT DE L'AJOUT : Pipeline pour les colis les plus rentables par destination --->
        const topParcelDestinationsPromise = Colis.aggregate([
            { $match: { date_enregistrement: dateFilter } },
            { $lookup: { from: 'trajets', localField: 'trajet', foreignField: '_id', as: 'trajetInfo' } },
            { $unwind: '$trajetInfo' },
            { $group: {
                _id: '$trajetInfo.villeArrivee', // On groupe par ville d'arrivée
                totalRevenue: { $sum: '$prix' },
                colisCount: { $sum: 1 }
            }},
            { $sort: { totalRevenue: -1 } },
            { $limit: 5 },
            { $project: {
                _id: 0,
                destination: '$_id', // On renomme le champ pour plus de clarté
                totalRevenue: 1,
                colisCount: 1
            }}
        ]);
        // <--- FIN DE L'AJOUT --->

        // <--- MODIFICATION : On ajoute notre nouvelle promesse à Promise.all --->
        const [topRoutes, topParcelDestinations] = await Promise.all([topRoutesPromise, topParcelDestinationsPromise]);

        res.json({ topRoutes, topParcelDestinations });
        // <--- FIN DE LA MODIFICATION --->

    } catch (err) {
        console.error("Erreur de calcul des insights de performance:", err);
        res.status(500).json({ message: "Erreur de calcul des insights de performance." });
    }
};