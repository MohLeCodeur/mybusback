// backend/controllers/stats.controller.js
const Reservation = require("../models/reservation.model");
const Colis = require("../models/colis.model");
const Client = require("../models/client.model");
const Trajet = require("../models/trajet.model");
const mongoose = require('mongoose');

/**
 * @desc    Récupérer les statistiques globales pour le tableau de bord admin.
 * @route   GET /api/admin/stats/overview
 * @access  Admin
 */
exports.getOverviewStats = async (req, res) => {
    try {
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
        console.error("Erreur getOverviewStats:", err);
        res.status(500).json({ message: "Erreur serveur lors de la récupération des statistiques." });
    }
};
// --- FONCTION DE REVENUS AMÉLIORÉE ---
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

    // --- Agrégations en parallèle ---
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

    // --- Calcul des KPIs ---
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

    // --- Préparation des données pour le graphique ---
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
    
    // Trier par date pour assurer la cohérence du graphique
    const chartData = Object.values(groupedForChart).sort((a,b) => a.dateObj - b.dateObj);

    return res.json({ summary, chartData });
    
  } catch (err) {
    console.error("Erreur de calcul des statistiques de revenus:", err);
    return res.status(500).json({ message: "Erreur de calcul des statistiques de revenus." });
  }
};


// --- NOUVELLE FONCTION POUR LES INSIGHTS DE PERFORMANCE ---
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

        // Agrégation pour les trajets les plus rentables
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

        // Agrégation pour les compagnies les plus performantes
        const topCompaniesPromise = Reservation.aggregate([
            { $match: { statut: 'confirmée', dateReservation: dateFilter } },
            { $lookup: { from: 'trajets', localField: 'trajet', foreignField: '_id', as: 'trajetInfo' } },
            { $unwind: '$trajetInfo' },
            { $group: {
                _id: '$trajetInfo.compagnie',
                totalRevenue: { $sum: { $multiply: ['$trajetInfo.prix', '$placesReservees'] } },
                reservationCount: { $sum: 1 }
            }},
            { $sort: { totalRevenue: -1 } },
            { $limit: 5 },
            { $project: { _id: 0, company: '$_id', totalRevenue: 1, reservationCount: 1 } }
        ]);

        const [topRoutes, topCompanies] = await Promise.all([topRoutesPromise, topCompaniesPromise]);

        res.json({ topRoutes, topCompanies });

    } catch (err) {
        console.error("Erreur de calcul des insights de performance:", err);
        res.status(500).json({ message: "Erreur de calcul des insights de performance." });
    }
};