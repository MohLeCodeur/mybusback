const Colis = require("../models/colis.model");
// const smsService = require('../services/sms.service'); // si SMS
const Client = require("../models/client.model"); 

exports.creerColis = async (req, res) => {
  try {
    // On log ce que le backend reçoit pour être sûr
    console.log("Corps de la requête reçu pour créer un colis :", req.body);

    // La manière la plus simple et la plus sûre est de passer directement req.body
    // au constructeur, car le frontend envoie maintenant un objet qui correspond au schéma.
    const nouveauColis = new Colis(req.body);

    // La validation (y compris la vérification que `trajet` est présent)
    // sera gérée par Mongoose lors du .save()
    await nouveauColis.save();
    
    // On renvoie le document complet qui a été créé
    return res.status(201).json(nouveauColis);

  } catch (err) {
    console.error("Erreur création colis :", err);

    // Si c'est une erreur de validation de Mongoose, on renvoie un message clair
    if (err.name === 'ValidationError') {
        // On peut extraire le premier message d'erreur pour plus de clarté
        const messages = Object.values(err.errors).map(val => val.message);
        return res.status(400).json({ message: messages[0] || "Données invalides." });
    }
    
    return res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

exports.getAllColis = async (req, res) => {
  try {
    const colisList = await Colis.find({})
      // --- CORRECTION : On peuple le trajet pour avoir les noms des villes ---
      .populate('trajet', 'villeDepart villeArrivee')
      .sort({ date_enregistrement: -1 });
      
    return res.json(colisList);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.getColisById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // --- LIGNE CORRIGÉE ---
    // On ajoute .populate('trajet') pour récupérer les détails du trajet associé.
    const colis = await Colis.findById(id).populate('trajet');
    // ----------------------

    if (!colis) {
      return res.status(404).json({ message: "Colis non trouvé" });
    }
    
    return res.json(colis);
    
  } catch (err) {
    console.error("Erreur getColisById:", err);
    return res.status(500).json({ message: err.message });
  }
};

exports.getColisByCode = async (req, res) => {
  try {
    const { code } = req.params;
    
    // --- LIGNE MODIFIÉE ET RENDUE PLUS ROBUSTE ---
    // On utilise la syntaxe objet pour .populate() pour spécifier exactement
    // les champs du trajet que nous voulons récupérer. C'est une meilleure pratique.
    const colis = await Colis.findOne({ code_suivi: code })
      .populate({
        path: 'trajet',
        select: 'villeDepart villeArrivee dateDepart compagnie' // On liste les champs nécessaires
      });
    // ---------------------------------------------------

    if (!colis) {
      return res.status(404).json({ message: "Colis non trouvé" });
    }

    // Log de débogage côté serveur pour être sûr de ce qu'on envoie
    console.log("Données du colis envoyées au front :", JSON.stringify(colis, null, 2));
    
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