// backend/seed.js
require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
if (!uri) throw new Error('⚠️  Ajoutez MONGO_URI dans .env');
const client = new MongoClient(uri);

(async () => {
  try {
    await client.connect();
    console.log('✅ Connecté à MongoDB');
    const db = client.db();
    
    // Collections
    const busesCollection = db.collection('buses');
    const trajetsCollection = db.collection('trajets');
    const reservationsCollection = db.collection('reservations');

    // Nettoyage
    console.log('Nettoyage des collections...');
    await busesCollection.deleteMany({});
    await trajetsCollection.deleteMany({});
    await reservationsCollection.deleteMany({});
    console.log('Collections nettoyées.');

    // Création des bus
    console.log('Création des bus...');
    const busData = [
      { numero: 'B-101', etat: 'en service', capacite: 50, createdAt: new Date(), updatedAt: new Date() },
      { numero: 'B-202', etat: 'en service', capacite: 55, createdAt: new Date(), updatedAt: new Date() },
    ];
    const insertedBusesResult = await busesCollection.insertMany(busData);
    const busIds = Object.values(insertedBusesResult.insertedIds);
    console.log(`✅ ${busIds.length} bus créés.`);

    // Génération des trajets
    console.log('Génération des trajets...');
    const companies = ['Diarra Transport', 'Bani Transport'];
    const villes = ['Bamako', 'Sikasso', 'Kayes', 'Mopti'];
    const heures = ['08:00', '14:00'];
    const trajetsToCreate = [];
    
    for (let i = 0; i < 10; i++) {
      const villeDepart = villes[i % villes.length];
      let villeArrivee = villes[(i + 1) % villes.length];
      
      const dateDepart = new Date();
      // Créer des trajets pour les 5 prochains jours
      dateDepart.setDate(dateDepart.getDate() + (i % 5)); 
      
      trajetsToCreate.push({
        villeDepart,
        villeArrivee,
        compagnie: companies[i % companies.length],
        dateDepart,
        heureDepart: heures[i % heures.length],
        prix: (Math.floor(Math.random() * 8) + 5) * 1000,
        placesDisponibles: 50,
        bus: busIds[i % busIds.length],
        isActive: true, // <-- LE CHAMP CRUCIAL EST BIEN LÀ
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    const { insertedCount } = await trajetsCollection.insertMany(trajetsToCreate);
    console.log(`✅ ${insertedCount} trajets créés.`);

  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
    process.exit(0);
  }
})();