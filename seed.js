// backend/seed.js
require('dotenv').config();
const { MongoClient } = require('mongodb');
const mongoose = require('mongoose'); // Utiliser Mongoose pour les ObjectIds

const uri = process.env.MONGO_URI;
if (!uri) throw new Error('⚠️  Ajoutez MONGO_URI dans .env');

const client = new MongoClient(uri);

(async () => {
  try {
    await client.connect();
    console.log('✅ Connecté à MongoDB');

    const db = client.db();
    const busesCollection = db.collection('buses');
    const trajetsCollection = db.collection('trajets');

    // 1. Purger les anciennes données (optionnel)
    console.log('Nettoyage des collections...');
    await busesCollection.deleteMany({});
    await trajetsCollection.deleteMany({});

    // 2. Créer des bus réels dans la base de données
    console.log('Création des bus réels...');
    const busData = [
      { numero: 'B-101', etat: 'en service', capacite: 50, createdAt: new Date(), updatedAt: new Date() },
      { numero: 'B-202', etat: 'en service', capacite: 55, createdAt: new Date(), updatedAt: new Date() },
      { numero: 'B-303', etat: 'maintenance', capacite: 50, createdAt: new Date(), updatedAt: new Date() },
      { numero: 'S-404', etat: 'en service', capacite: 60, createdAt: new Date(), updatedAt: new Date() },
    ];
    const insertedBuses = await busesCollection.insertMany(busData);
    const busIds = Object.values(insertedBuses.insertedIds); // Récupère les IDs des bus créés
    console.log(`✅ ${busIds.length} bus créés.`);

    // 3. Données pour les trajets
    const companies = ['Diarra Transport', 'Bani Transport', 'Sonef Mali', 'Star Voyage'];
    const villes = ['Bamako', 'Sikasso', 'Kayes', 'Mopti', 'Ségou'];
    const heures = ['07:00', '11:30', '14:45', '18:00'];

    // 4. Générer des trajets en associant un bus réel
    console.log('Génération des trajets...');
    const trajetsToCreate = [];
    for (let i = 0; i < 20; i++) { // Créons 20 trajets pour l'exemple
      const villeDepart = villes[Math.floor(Math.random() * villes.length)];
      let villeArrivee = villes[Math.floor(Math.random() * villes.length)];
      while (villeArrivee === villeDepart) { // S'assurer que départ et arrivée sont différents
        villeArrivee = villes[Math.floor(Math.random() * villes.length)];
      }

      const dateDepart = new Date();
      dateDepart.setDate(dateDepart.getDate() + Math.floor(Math.random() * 7)); // Dans les 7 prochains jours

      trajetsToCreate.push({
        villeDepart,
        villeArrivee,
        compagnie: companies[Math.floor(Math.random() * companies.length)],
        dateDepart,
        heureDepart: heures[Math.floor(Math.random() * heures.length)],
        prix: (Math.floor(Math.random() * 10) + 5) * 1000, // Prix entre 5000 et 15000
        placesDisponibles: 50,
        // --- LA PARTIE LA PLUS IMPORTANTE ---
        // On assigne un ID de bus réel de manière aléatoire
        bus: busIds[Math.floor(Math.random() * busIds.length)],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const { insertedCount } = await trajetsCollection.insertMany(trajetsToCreate);
    console.log(`✅ ${insertedCount} trajets créés et liés à des bus réels.`);

  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
    process.exit(0);
  }
})();