// backend/models/client.model.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const clientSchema = new mongoose.Schema(
  {
    prenom: { type: String, required: true },
    nom: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    mot_de_passe: { type: String, required: true },
    telephone: { type: String },
    role: { type: String, enum: ["client", "admin"], default: "client" },
  },
  { timestamps: true }
);

// Hachage du mot de passe avant de sauvegarder
clientSchema.pre("save", async function (next) {
  if (!this.isModified("mot_de_passe")) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.mot_de_passe = await bcrypt.hash(this.mot_de_passe, salt);
  next();
});

// Méthode pour comparer les mots de passe
clientSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.mot_de_passe);
};

module.exports = mongoose.model("Client", clientSchema);