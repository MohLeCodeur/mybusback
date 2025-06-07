// backend/models/chauffeur.model.js
const mongoose = require("mongoose");

const chauffeurSchema = new mongoose.Schema(
  {
    prenom: { type: String, required: true },
    nom: { type: String, required: true },
    telephone: { type: String, required: true, maxlength: 12 },
    bus: { type: mongoose.Schema.Types.ObjectId, ref: "Bus", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Chauffeur", chauffeurSchema);