const Colis = require("../models/colis.model");
// const smsService = require('../services/sms.service'); // si SMS

exports.creerColis = async (req, res) => {
  try {
    const {
      description,
      poids,
      distance,
      valeur,
      expediteur_nom,
      expediteur_telephone,
      destinataire_nom,
      destinataire_telephone,
    } = req.body;

    const nouveauColis = new Colis({
      description,
      poids,
      distance,
      valeur,
      expediteur_nom,
      expediteur_telephone,
      destinataire_nom,
      destinataire_telephone,
    });

    await nouveauColis.save();
    return res.status(201).json(nouveauColis);
  } catch (err) {
    console.error("Erreur création colis :", err);
    return res.status(400).json({ message: err.message });
  }
};

exports.getAllColis = async (req, res) => {
  try {
    const colisList = await Colis.find().sort({ date_enregistrement: -1 });
    return res.json(colisList);
  } catch (err) {
    console.error("Erreur récupération colis :", err);
    return res.status(500).json({ message: err.message });
  }
};

exports.getColisById = async (req, res) => {
  try {
    const { id } = req.params;
    const colis = await Colis.findById(id);
    if (!colis) return res.status(404).json({ message: "Colis non trouvé" });
    return res.json(colis);
  } catch (err) {
    console.error("Erreur récupération colis :", err);
    return res.status(500).json({ message: err.message });
  }
};

// Nouvelle méthode : récupérer un colis via son code de suivi
exports.getColisByCode = async (req, res) => {
  try {
    const { code } = req.params;
    const colis = await Colis.findOne({ code_suivi: code });
    if (!colis) return res.status(404).json({ message: "Colis non trouvé" });
    return res.json(colis);
  } catch (err) {
    console.error("Erreur getColisByCode :", err);
    return res.status(500).json({ message: err.message });
  }
};

exports.updateStatutColis = async (req, res) => {
  try {
    const { id } = req.params;
    const { statut } = req.body;

    if (!["enregistré", "encours", "arrivé"].includes(statut)) {
      return res.status(400).json({ message: "Statut invalide" });
    }

    const colis = await Colis.findById(id);
    if (!colis) return res.status(404).json({ message: "Colis non trouvé" });

    colis.statut = statut;
    await colis.save();

    // Envoi SMS si nécessaire
    // if (statut === 'arrivé') {
    //   const message = `Votre colis (${colis.code_suivi}) est arrivé.`;
    //   await smsService.sendSMS(colis.destinataire_telephone, message);
    // }

    return res.json(colis);
  } catch (err) {
    console.error("Erreur mise à jour statut :", err);
    return res.status(500).json({ message: err.message });
  }
};

exports.updateColis = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // --- CORRECTION ET AMÉLIORATION DE LA LOGIQUE ---
    
    // 1. Récupérer le colis existant
    const colis = await Colis.findById(id);
    if (!colis) {
      return res.status(404).json({ message: "Colis non trouvé" });
    }

    // 2. Appliquer les mises à jour du formulaire
    Object.assign(colis, updates);

    // 3. Le "hook" pre-save dans le modèle s'occupera de recalculer le prix
    //    car nous allons utiliser .save() qui déclenche ce hook.
    //    Le hook est déjà programmé pour recalculer le prix si poids, distance ou valeur sont modifiés.

    // 4. Sauvegarder le document mis à jour
    const updatedColis = await colis.save();
    
    // ------------------------------------------------

    // 5. Renvoyer le colis mis à jour (avec le nouveau prix)
    return res.json(updatedColis);

  } catch (err) {
    console.error("Erreur update colis :", err);
    return res.status(400).json({ message: err.message });
  }
};
