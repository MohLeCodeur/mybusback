// backend/seed.js
require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
if (!uri) throw new Error('⚠️  Veuillez ajouter MONGO_URI à votre fichier .env');

const client = new MongoClient(uri);

// Données réalistes pour les capitales régionales du Mali
const capitalesRegionales = [
    { nom: "Bamako", coords: { lat: 12.6392, lng: -8.0029 } },
    { nom: "Kayes", coords: { lat: 14.4469, lng: -11.4443 } },
    { nom: "Koulikoro", coords: { lat: 12.8623, lng: -7.5599 } },
    { nom: "Sikasso", coords: { lat: 11.3176, lng: -5.6665 } },
    { nom: "Ségou", coords: { lat: 13.4317, lng: -6.2658 } },
    { nom: "Mopti", coords: { lat: 14.4944, lng: -4.1970 } },
    { nom: "Tombouctou", coords: { lat: 16.7713, lng: -3.0074 } },
    { nom: "Gao", coords: { lat: 16.2666, lng: -0.0400 } },
    { nom: "Kidal", coords: { lat: 18.4411, lng: 1.4078 } },
];

async function runSeeding() {
    try {
        await client.connect();
        console.log('✅ Connecté à MongoDB pour le seeding.');
        const db = client.db();
        
        // Collections
        const busesCollection = db.collection('buses');
        const trajetsCollection = db.collection('trajets');
        const reservationsCollection = db.collection('reservations');
        const colisCollection = db.collection('colis');
        const chauffeursCollection = db.collection('chauffeurs');
        const liveTripsCollection = db.collection('livetrips');

        // 1. Nettoyage complet
        console.log('Nettoyage de toutes les collections de test...');
        await busesCollection.deleteMany({});
        await trajetsCollection.deleteMany({});
        await reservationsCollection.deleteMany({});
        await colisCollection.deleteMany({});
        await chauffeursCollection.deleteMany({});
        await liveTripsCollection.deleteMany({});
        console.log('Collections nettoyées.');

        // 2. Création des bus
        console.log('Création des bus...');
        const busData = [
            { numero: 'BKO-001', etat: 'en service', capacite: 55, createdAt: new Date(), updatedAt: new Date() },
            { numero: 'SEG-002', etat: 'en service', capacite: 50, createdAt: new Date(), updatedAt: new Date() },
            { numero: 'MPT-003', etat: 'en service', capacite: 60, createdAt: new Date(), updatedAt: new Date() },
            { numero: 'KYS-004', etat: 'maintenance', capacite: 55, createdAt: new Date(), updatedAt: new Date() },
        ];
        const insertedBusesResult = await busesCollection.insertMany(busData);
        const busIds = Object.values(insertedBusesResult.insertedIds);
        console.log(`✅ ${busIds.length} bus créés.`);

        // 3. Création des trajets avec les coordonnées GPS
        console.log('Génération des trajets...');
        const companies = ['Sama Transport', 'Bani Transport', 'Sonef', 'Diarra Transport'];
        const trajetsToCreate = [];

        // Créer des trajets entre différentes paires de villes
        const trajetsPairs = [
            { from: "Bamako", to: "Ségou" },
            { from: "Bamako", to: "Sikasso" },
            { from: "Ségou", to: "Mopti" },
            { from: "Bamako", to: "Kayes" },
            { from: "Mopti", to: "Gao" },
            { from: "Sikasso", to: "Bamako" }, // Trajet retour
            { from: "Kayes", to: "Bamako" },   // Trajet retour
        ];

        trajetsPairs.forEach((pair, index) => {
            const departCity = capitalesRegionales.find(c => c.nom === pair.from);
            const arriveeCity = capitalesRegionales.find(c => c.nom === pair.to);

            if (!departCity || !arriveeCity) return; // Sécurité

            // Créer 2 trajets pour chaque paire de villes, à des jours différents
            for (let i = 1; i <= 2; i++) {
                const dateDepart = new Date();
                dateDepart.setUTCDate(dateDepart.getUTCDate() + i + index); // Assure des dates futures variées
                dateDepart.setUTCHours(i === 1 ? 8 : 15, 0, 0, 0); // Deux horaires différents

                trajetsToCreate.push({
                    villeDepart: departCity.nom,
                    villeArrivee: arriveeCity.nom,
                    coordsDepart: departCity.coords,
                    coordsArrivee: arriveeCity.coords,
                    compagnie: companies[index % companies.length],
                    dateDepart: dateDepart,
                    heureDepart: dateDepart.getUTCHours() === 8 ? '08:00' : '15:00',
                    prix: (Math.floor(Math.random() * 10) + 7) * 1000,
                    placesDisponibles: 50,
                    bus: busIds[index % busIds.length],
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
            }
        });

        if (trajetsToCreate.length > 0) {
            const { insertedCount } = await trajetsCollection.insertMany(trajetsToCreate);
            console.log(`✅ ${insertedCount} trajets réalistes créés avec coordonnées GPS.`);
        } else {
            console.log("Aucun trajet n'a été créé. Vérifiez les données des villes.");
        }

        console.log('\nOpération de seeding terminée avec succès !');

    } catch (err) {
        console.error("❌ Une erreur est survenue lors du seeding:", err);
    } finally {
        await client.close();
        console.log('Connexion à MongoDB fermée.');
        process.exit(0);
    }
}

runSeeding();