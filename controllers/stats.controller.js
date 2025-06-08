// backend/controllers/stats.controller.js
const Reservation = require("../models/reservation.model");

// GET /api/admin/stats/revenus?periode=weekly|monthly
exports.getRevenus = async (req, res) => {
  try {
    const periode = req.query.periode === "monthly" ? "monthly" : "weekly";
    let matchConditions = {};
    let groupId;

    // --- CORRECTION : AJOUT DU FILTRE SUR LE STATUT ---
    // On ne prend en compte que les réservations qui ont été confirmées (payées)
    matchConditions.statut = 'confirmée';
    // ----------------------------------------------------

    if (periode === "weekly") {
      // Pour les 7 derniers jours
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);

      // La condition de date s'ajoute à la condition de statut
      matchConditions.dateReservation = { $gte: startDate };

      // Regroupement par jour
      groupId = {
        year: { $year: "$dateReservation" },
        month: { $month: "$dateReservation" },
        day: { $dayOfMonth: "$dateReservation" },
      };
    } else { // monthly
      // Pour les 12 derniers mois
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 12);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);

      matchConditions.dateReservation = { $gte: startDate };

      // Regroupement par mois
      groupId = {
        year: { $year: "$dateReservation" },
        month: { $month: "$dateReservation" },
      };
    }

    const results = await Reservation.aggregate([
      { $match: matchConditions }, // Étape 1: Filtre par statut ET par date
      {
        $lookup: { // Étape 2: Jointure avec la collection 'trajets'
          from: "trajets",
          localField: "trajet",
          foreignField: "_id",
          as: "trajetInfo",
        },
      },
      { $unwind: "$trajetInfo" }, // Étape 3: "Déplie" le tableau
      {
        $group: { // Étape 4: Regroupe et calcule la somme
          _id: groupId,
          // Calcule le revenu en multipliant le prix du trajet par le nombre de places réservées
          total: { $sum: { $multiply: ["$trajetInfo.prix", "$placesReservees"] } },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }, // Trier par date
    ]);

    // Formater la réponse pour qu'elle soit facile à utiliser par Recharts
    const data = results.map((item) => {
        let label;
        if (periode === 'weekly') {
            // Formate la date en JJ/MM
            const day = String(item._id.day).padStart(2, '0');
            const month = String(item._id.month).padStart(2, '0');
            label = `${day}/${month}`;
        } else {
            // Formate le mois en MM/AAAA
            const month = String(item._id.month).padStart(2, '0');
            label = `${month}/${item._id.year}`;
        }
        return {
          label: label,
          total: item.total,
        }
    });

    return res.json(data);
  } catch (err) {
    console.error("Erreur de calcul des statistiques de revenus:", err);
    return res.status(500).json({ message: err.message });
  }
};