const Reservation = require("../models/reservation.model");
const Trajet = require("../models/trajet.model");

// GET /api/admin/stats/revenus?periode=weekly|monthly
exports.getRevenus = async (req, res) => {
  try {
    const periode = req.query.periode === "monthly" ? "monthly" : "weekly";
    let match = {};
    let groupId;

    if (periode === "weekly") {
      // Derniers 7 jours
      const start = new Date();
      start.setDate(start.getDate() - 6);
      match.date_reservation = { $gte: start };
      groupId = {
        $dateToString: { format: "%Y-%m-%d", date: "$date_reservation" },
      };
    } else {
      // Derniers 12 mois
      const start = new Date();
      start.setMonth(start.getMonth() - 11);
      match.date_reservation = { $gte: start };
      groupId = {
        $dateToString: { format: "%Y-%m", date: "$date_reservation" },
      };
    }

    const results = await Reservation.aggregate([
      { $match: match },
      {
        $lookup: {
          from: "trajets", // nom de la collection
          localField: "trajet",
          foreignField: "_id",
          as: "trajet",
        },
      },
      { $unwind: "$trajet" },
      {
        $group: {
          _id: groupId,
          total: { $sum: "$trajet.prix" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Formater la réponse
    const data = results.map((item) => ({
      label: item._id,
      total: item.total,
    }));
    return res.json(data);
  } catch (err) {
    console.error("Erreur stats revenue:", err);
    return res.status(500).json({ message: err.message });
  }
};
