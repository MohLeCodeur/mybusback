// backend/clear-reservations.js
// Ce script supprime TOUTES les réservations de la base de données.
// Il ne touche PAS aux autres collections (bus, trajets, etc.).

require('dotenv').config();
const { MongoClient } = require('mongodb');

// URI de connexion à MongoDB
const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('❌ Erreur: Veuillez ajouter MONGO_URI à votre fichier .env');
  process.exit(1);
}

const client = new MongoClient(uri);

const run = async () => {
  try {
    // 1. Connexion à la base de données
    await client.connect();
    console.log('✅ Connecté à MongoDB');

    // 2. Sélection de la base de données et de la collection 'reservations'
    const db = client.db();
    const reservationsCollection = db.collection('reservations');
    console.log("Ciblage de la collection 'reservations'...");

    // 3. Compter le nombre de réservations avant suppression
    const countBefore = await reservationsCollection.countDocuments();
    if (countBefore === 0) {
      console.log('ℹ️ Aucune réservation à supprimer. La collection est déjà vide.');
      return; // On sort du script si il n'y a rien à faire
    }
    console.log(`🔍 Trouvé ${countBefore} réservation(s) à supprimer.`);
    
    // 4. Suppression de tous les documents dans la collection
    const deleteResult = await reservationsCollection.deleteMany({});
    console.log(`✅ Succès ! ${deleteResult.deletedCount} réservation(s) ont été supprimées.`);

  } catch (err) {
    console.error("❌ Une erreur est survenue lors de la suppression des réservations:", err);
  } finally {
    // 5. Fermeture de la connexion
    await client.close();
    console.log('Connexion à MongoDB fermée.');
  }
};

// Lancement du script
run();