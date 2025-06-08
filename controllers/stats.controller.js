// backend/controllers/stats.controller.js
const Reservation = require("../models/reservation.model");
const Colis = require("../models/colis.model");

// GET /api/admin/stats/revenus?periode=weekly|monthly
exports.getRevenus = async (req, res) => {
  try {
    const periode = req.query.periode === "monthly" ? "monthly" : "weekly";
    let dateFilter = {};

    // Définir la plage de dates
    if (periode === "weekly") {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      dateFilter = { $gte: startDate };
    } else { // monthly
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 12);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      dateFilter = { $gte: startDate };
    }

    // --- 1. Agrégation pour les revenus des Réservations ---
    const reservationsPromise = Reservation.aggregate([
      { $match: { statut: 'confirmée', dateReservation: dateFilter } },
      { $lookup: { from: "trajets", localField: "trajet", foreignField: "_id", as: "trajetInfo" } },
      { $unwind: "$trajetInfo" },
      { $project: {
          date: "$dateReservation",
          revenue: { $multiply: ["$trajetInfo.prix", "$placesReservees"] }
      }}
    ]);

    // --- 2. Agrégation pour les revenus des Colis ---
    // (On suppose que tous les colis enregistrés représentent un revenu)
    const colisPromise = Colis.aggregate([
        { $match: { date_enregistrement: dateFilter } },
        { $project: {
            date: "$date_enregistrement",
            revenue: "$prix"
        }}
    ]);

    // Exécuter les deux agrégations en parallèle
    const [reservationRevenues, colisRevenues] = await Promise.all([reservationsPromise, colisPromise]);

    // --- 3. Combiner et calculer les statistiques ---
    const allTransactions = [
        ...reservationRevenues.map(r => ({ ...r, type: 'Billet' })),
        ...colisRevenues.map(c => ({ ...c, type: 'Colis' }))
    ];

    const totalRevenue = allTransactions.reduce((sum, item) => sum + (item.revenue || 0), 0);
    const totalRevenueBillets = reservationRevenues.reduce((sum, item) => sum + (item.revenue || 0), 0);
    const totalRevenueColis = colisRevenues.reduce((sum, item) => sum + (item.revenue || 0), 0);
    
    // --- 4. Préparer les données pour le graphique ---
    const groupedForChart = allTransactions.reduce((acc, item) => {
        const date = new Date(item.date);
        let key;
        if (periode === 'weekly') {
            key = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
        } else {
            key = `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
        }
        
        if (!acc[key]) {
            acc[key] = { label: key, billets: 0, colis: 0 };
        }
        
        if(item.type === 'Billet') {
            acc[key].billets += item.revenue;
        } else if (item.type === 'Colis') {
            acc[key].colis += item.revenue;
        }
        
        return acc;
    }, {});

    const chartData = Object.values(groupedForChart).sort((a,b) => {
        const dateA = new Date(a.label.split('/').reverse().join('-'));
        const dateB = new Date(b.label.split('/').reverse().join('-'));
        return dateA - dateB;
    });

    // Renvoyer l'objet structuré complet
    return res.json({
      summary: {
        totalRevenue,
        totalRevenueBillets,
        totalRevenueColis,
        totalTransactions: allTransactions.length,
      },
      chartData,
    });
    
  } catch (err) {
    console.error("Erreur de calcul des statistiques de revenus:", err);
    return res.status(500).json({ message: err.message });
  }
};