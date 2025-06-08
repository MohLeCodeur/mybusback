// backend/controllers/stats.controller.js
const Reservation = require("../models/reservation.model");

// GET /api/admin/stats/revenus?periode=weekly|monthly
exports.getRevenus = async (req, res) => {
  try {
    const periode = req.query.periode === "monthly" ? "monthly" : "weekly";
    let matchConditions = { statut: 'confirmée' }; // Filtre crucial : que les paiements réussis

    // Définir la plage de dates en fonction de la période choisie
    if (periode === "weekly") {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      matchConditions.dateReservation = { $gte: startDate };
    } else { // monthly
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 12);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      matchConditions.dateReservation = { $gte: startDate };
    }

    // Pipeline d'agrégation pour récupérer chaque transaction confirmée avec son revenu
    const aggregationPipeline = [
      { $match: matchConditions },
      { 
        $lookup: { 
          from: "trajets", 
          localField: "trajet", 
          foreignField: "_id", 
          as: "trajetInfo" 
        } 
      },
      { $unwind: "$trajetInfo" },
      { 
        $project: {
          dateReservation: "$dateReservation",
          revenue: { $multiply: ["$trajetInfo.prix", "$placesReservees"] }
        }
      }
    ];

    const transactions = await Reservation.aggregate(aggregationPipeline);

    // Calculer les statistiques globales à partir des transactions
    const totalRevenue = transactions.reduce((sum, item) => sum + item.revenue, 0);
    const totalTransactions = transactions.length;

    // Regrouper les données par jour ou par mois pour le graphique
    const groupedForChart = transactions.reduce((acc, item) => {
        const date = new Date(item.dateReservation);
        let key;
        if (periode === 'weekly') {
            key = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
        } else {
            key = `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
        }
        
        if (!acc[key]) {
            acc[key] = { label: key, total: 0 };
        }
        acc[key].total += item.revenue;
        
        return acc;
    }, {});

    const chartData = Object.values(groupedForChart).sort((a,b) => {
        const dateA = new Date(a.label.split('/').reverse().join('-'));
        const dateB = new Date(b.label.split('/').reverse().join('-'));
        return dateA - dateB;
    });

    // Renvoyer un objet structuré au frontend
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