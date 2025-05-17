const Trajet = require('../models/Trajet');

// controllers/trajets.js
exports.getTrajets = async (req, res) => {
  const {
    villeDepart,
    villeArrivee,
    date,
    compagnie,
    limit = 15,          // valeur par défaut
    page  = 1
  } = req.query;

  const query = {};
  if (villeDepart)  query.villeDepart  = villeDepart;
  if (villeArrivee) query.villeArrivee = villeArrivee;
  if (date)         query.dateDepart   = { $gte: new Date(date) };
  if (compagnie)    query.compagnie    = compagnie;

  const skip   = (+page - 1) * +limit;
  const [docs, total] = await Promise.all([
    Trajet.find(query).skip(skip).limit(+limit).sort({ dateDepart: 1 }),
    Trajet.countDocuments(query)
  ]);

  res.json({
    docs,
    total,
    page: +page,
    pages: Math.ceil(total / +limit)
  });
};


exports.getTrajetById = async (req, res) => {
  try {
    const trajet = await Trajet.findById(req.params.id);
    if (!trajet) return res.status(404).json({ message: 'Trajet non trouvé' });
    res.json(trajet);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};