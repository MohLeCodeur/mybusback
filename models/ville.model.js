// backend/models/ville.model.js
const mongoose = require("mongoose");

const villeSchema = new mongoose.Schema(
  {
    nom: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

const tarifSchema = new mongoose.Schema(
  {
    depart: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ville",
      required: true,
    },
    arrivee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ville",
      required: true,
    },
    prix: { type: Number, required: true },
  },
  { timestamps: true }
);

const Ville = mongoose.model("Ville", villeSchema);
const Tarif = mongoose.model("Tarif", tarifSchema);

module.exports = { Ville, Tarif };