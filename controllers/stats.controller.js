// backend/controllers/stats.controller.js
const Reservation = require("../models/reservation.model");

exports.getRevenus = async (req, res) => {
  try {
    const periode = req.query.periode === "monthly" ? "monthly" : "weekly";
    let matchConditions = { statut: 'confirmée' };
    let groupId;

    if (periode === "weekly") {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      matchConditions.dateReservation = { $gte: startDate };
      groupId = { year: { $year: "$dateReservation" }, month: { $month: "$dateReservation" }, day: { $dayOfMonth: "$dateReservation" } };
    } else {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 12);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      matchConditions.dateReservation = { $gte: startDate };
      groupId = { year: { $year: "$dateReservation" }, month: { $month: "$dateReservation" } };
    }

    // Pipeline d'agrégation
    const aggregationPipeline = [
      { $match: matchConditions },
      { $lookup: { from: "trajets", localField: "trajet", foreignField: "_id", as: "trajetInfo" } },
      { $unwind: "$trajetInfo" },
      { $project: { // Calculer le revenu pour chaque réservation
          dateReservation: "$dateReservation",
          revenue: { $multiply: ["$trajetInfo.prix", "$placesReservees"] }
      }}
    ];

    // Exécuter l'agrégation
    const results = await Reservation.aggregate(aggregationPipeline);

    // --- NOUVELLE PARTIE : Calculer les statistiques globales ---
    const totalRevenue = results.reduce((sum, item) => sum + item.revenue, 0);
    const totalTransactions = results.length;
    // -----------------------------------------------------------
    
    // --- NOUVELLE PARTIE : Regrouper les résultats pour le graphique ---
    const groupedData = results.reduce((acc, item) => {
        let key;
        if (periode === 'weekly') {
            const date = new Date(item.dateReservation);
            key = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
        } else {
            const date = new Date(item.dateReservation);
            key = `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
        }
        
        if (!acc[key]) {
            acc[key] = 0;
        }
        acc[key] += item.revenue;
        
        return acc;
    }, {});

    const chartData = Object.keys(groupedData).map(key => ({
        label: key,
        total: groupedData[key]
    })).sort((a,b) => new Date(a.label.split('/').reverse().join('-')) - new Date(b.label.split('/').reverse().join('-'))); // Trier par date
    // -------------------------------------------------------------------

    // Renvoyer l'objet structuré
    return res.json({
      summary: {
        totalRevenue,
        totalTransactions,
      },
      chartData,
    });
    
  } catch (err) {
    console.error("Erreur de calcul des statistiques de revenus:", err);
    return res.status(500).json({ message: err.message });
  }
};