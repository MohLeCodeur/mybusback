// backend/models/colis.model.js
const mongoose = require("mongoose");

/**
 * Génère un code de suivi alphanumérique unique et facile à lire.
 * @param {number} length - La longueur du code à générer.
 * @returns {string} Le code généré.
 */
function generateCode(length = 8) {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // Caractères sans ambiguïté (0/O, 1/I retirés)
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Calcule le prix du transport d'un colis en fonction de son poids.
 * @param {number} poids - Le poids du colis en kg.
 * @returns {number} Le prix calculé en FCFA.
 */
function calculPrix(poids) {
  const BASE_FEE = 500; // Frais de dossier fixes
  const PRICE_PER_KG = 300; // Prix par kilogramme
  return BASE_FEE + (poids * PRICE_PER_KG);
}


const colisSchema = new mongoose.Schema({
  // Référence obligatoire au trajet sur lequel le colis voyagera
  trajet: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Trajet', 
    required: [true, "Un trajet doit être associé au colis."]
  },
  
  description: { type: String, required: true },
  poids: { type: Number, required: true },
  prix: { type: Number }, // Calculé automatiquement

  statut: {
    type: String,
    enum: ["enregistré", "encours", "arrivé", "annulé"], // Statuts possibles
    default: "enregistré",
  },
  
  code_suivi: { type: String, unique: true },
  
  // Informations sur l'expéditeur
  expediteur_nom: { type: String, required: true },
  expediteur_telephone: { type: String, required: true },
  expediteur_email: { type: String, index: true }, // Pour les notifications
  
  // Informations sur le destinataire
  destinataire_nom: { type: String, required: true },
  destinataire_telephone: { type: String, required: true },
  
  date_enregistrement: { type: Date, default: Date.now },
}, { timestamps: true });


// Hook Mongoose qui s'exécute avant chaque sauvegarde
colisSchema.pre("save", async function (next) {
  // Si c'est un nouveau document, générer un code de suivi unique
  if (this.isNew) {
    let code;
    let exists = true;
    while (exists) {
      code = generateCode();
      exists = await this.constructor.exists({ code_suivi: code });
    }
    this.code_suivi = code;
  }

  // Si le poids a été modifié (ou si c'est un nouveau document), recalculer le prix
  if (this.isModified('poids') || this.isNew) {
    this.prix = calculPrix(this.poids);
  }

  next(); // Poursuivre l'opération de sauvegarde
});

module.exports = mongoose.model("Colis", colisSchema);