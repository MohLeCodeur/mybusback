// backend/models/bus.model.js
const mongoose = require("mongoose");

const busSchema = new mongoose.Schema(
  {
    numero: { type: String, required: true, unique: true },
    etat: {
      type: String,
      required: true,
      enum: ["en service", "maintenance", "hors service"],
      default: "en service",
    },
    capacite: { type: Number, default: 50, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Bus", busSchema);