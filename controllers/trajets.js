const Trajet = require('../models/Trajet');

exports.getTrajets = async (req, res) => {
  try {
    const { villeDepart, villeArrivee, date, compagnie } = req.query;

    let query = {};
    
    if (villeDepart) query.villeDepart = villeDepart;
    if (villeArrivee) query.villeArrivee = villeArrivee;
    if (date)         query.dateDepart   = { $gte: new Date(date) };
     if (compagnie)    query.compagnie    = compagnie;
    
    const trajets = await Trajet.find(query);
    res.json(trajets);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
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