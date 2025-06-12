const Colis = require("../models/colis.model");
// const smsService = require('../services/sms.service'); // si SMS
const Client = require("../models/client.model"); 

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
    if (!colis) {
      return res.status(404).json({ message: "Colis non trouvé" });
    }

    // On ne fait rien si le statut ne change pas
    if (colis.statut === statut) {
        return res.json(colis);
    }
    
    colis.statut = statut;
    await colis.save();

    // --- SECTION D'ÉMISSION DE LA NOTIFICATION ---
    // 1. Vérifier si on a un email d'expéditeur
    if (colis.expediteur_email) {
        // 2. Trouver l'utilisateur correspondant à cet email
        const user = await Client.findOne({ email: colis.expediteur_email });

        // 3. S'il existe et qu'il est en ligne, lui envoyer la notif
        if (user) {
            const recipientSocketId = req.onlineUsers[user._id.toString()];
            if (recipientSocketId) {
                console.log(`Envoi de la notification de colis à l'utilisateur ${user._id} sur le socket ${recipientSocketId}`);
                
                let message;
                if (statut === 'encours') {
                    message = `Votre colis pour ${colis.destinataire_nom} est maintenant en cours de livraison.`;
                } else if (statut === 'arrivé') {
                    message = `Bonne nouvelle ! Votre colis pour ${colis.destinataire_nom} est arrivé à destination.`;
                } else {
                    message = `Le statut de votre colis est maintenant : ${statut}.`;
                }

                req.io.to(recipientSocketId).emit("getNotification", {
                    title: `Mise à jour du colis #${colis.code_suivi}`,
                    message: message,
                    link: `/dashboard` // Le client peut voir les détails dans son dashboard
                });
            }
        }
    }
    // ---------------------------------------------

    return res.json(colis);

  } catch (err) {
    console.error("Erreur mise à jour statut colis :", err);
    return res.status(500).json({ message: err.message });
  }
};
exports.deleteColis = async (req, res) => {
  try {
    const { id } = req.params;
    const colis = await Colis.findByIdAndDelete(id);

    if (!colis) {
      return res.status(404).json({ message: "Colis non trouvé." });
    }

    res.json({ message: "Colis supprimé avec succès." });
  } catch (err) {
    console.error("Erreur deleteColis:", err);
    res.status(500).json({ message: "Erreur serveur lors de la suppression du colis." });
  }
};

exports.updateColis = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // 1. Récupérer le colis AVANT la mise à jour pour connaître son ancien statut
    const colisAvant = await Colis.findById(id).lean();
    if (!colisAvant) {
      return res.status(404).json({ message: "Colis non trouvé" });
    }
    const ancienStatut = colisAvant.statut;

    // 2. Mettre à jour le document
    const colisApres = await Colis.findByIdAndUpdate(id, updates, { new: true });
    
    // --- NOUVELLE LOGIQUE DE NOTIFICATION ---
    // 3. Vérifier si le statut a réellement changé
    if (ancienStatut !== colisApres.statut) {
      console.log(`Le statut du colis ${colisApres.code_suivi} a changé de '${ancienStatut}' à '${colisApres.statut}'. Envoi de notification...`);

      // La suite de la logique est identique à celle de updateStatutColis
      if (colisApres.expediteur_email) {
          const user = await Client.findOne({ email: colisApres.expediteur_email });
          if (user) {
              const recipientSocketId = req.onlineUsers[user._id.toString()];
              if (recipientSocketId) {
                  let message;
                  if (colisApres.statut === 'encours') message = `Votre colis pour ${colisApres.destinataire_nom} est maintenant en cours de livraison.`;
                  else if (colisApres.statut === 'arrivé') message = `Bonne nouvelle ! Votre colis pour ${colisApres.destinataire_nom} est arrivé à destination.`;
                  else message = `Le statut de votre colis est maintenant : ${colisApres.statut}.`;

                  req.io.to(recipientSocketId).emit("getNotification", {
                      title: `Mise à jour du colis #${colisApres.code_suivi}`,
                      message: message,
                      link: `/dashboard`
                  });
                  console.log(`Notification envoyée à ${user.email}`);
              } else {
                  console.log(`Utilisateur ${user.email} trouvé mais n'est pas en ligne.`);
              }
          } else {
              console.log(`Aucun utilisateur enregistré avec l'email ${colisApres.expediteur_email}.`);
          }
      }
    }
    // ----------------------------------------

    return res.json(colisApres);

  } catch (err) {
    console.error("Erreur update colis :", err);
    return res.status(400).json({ message: err.message });
  }
};