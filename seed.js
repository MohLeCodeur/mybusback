// backend/seed.js
// Ce script nettoie et peuple les collections avec des données de test enrichies.

require('dotenv').config();
const mongoose = require('mongoose');
const Trajet = require('./models/trajet.model');
const Bus = require('./models/bus.model');
const Reservation = require('./models/reservation.model');

// --- LISTE DE VILLES ENRICHIE ---
const CITIES_COORDS = {
    'Bamako': { lat: 12.6392, lng: -8.0029 },
    'Kayes': { lat: 14.4469, lng: -11.4443 },
    'Koulikoro': { lat: 12.8628, lng: -7.5599 },
    'Sikasso': { lat: 11.3176, lng: -5.6665 },
    'Ségou': { lat: 13.4317, lng: -6.2658 },
    'Mopti': { lat: 14.4944, lng: -4.1970 },
    'Gao': { lat: 16.2666, lng: -0.0400 },
    'Kidal': { lat: 18.4411, lng: 1.4078 },
    'Koutiala': { lat: 12.3917, lng: -5.4642 },
    'Kita': { lat: 13.0444, lng: -9.4895 },
    'Bougouni': { lat: 11.4194, lng: -7.4817 },
};



const HEURES_DEPART = ['06:00', '07:30', '08:00', '09:30', '14:00', '16:00', '20:00', '21:00'];

const seedDatabase = async () => {
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) {
        console.error('❌ Erreur: MONGODB_URI n\'est pas défini dans .env');
        process.exit(1);
    }

    try {
        await mongoose.connect(mongoURI);
        console.log('✅ Connecté à MongoDB');

        console.log('Nettoyage des collections...');
        await Trajet.deleteMany({});
        await Bus.deleteMany({});
        await Reservation.deleteMany({});
        console.log('Collections nettoyées.');

        console.log('Création de 15 bus de test...');
        const busData = [];
        for (let i = 1; i <= 15; i++) {
            busData.push({
                numero: `MYBUS-${200 + i}`,
                etat: 'en service',
                capacite: 50 + (i % 4 * 5) // Capacités: 50, 55, 60, 65
            });
        }
        const createdBuses = await Bus.insertMany(busData);
        console.log(`✅ ${createdBuses.length} bus créés.`);

        console.log('Génération de 50 trajets entre aujourd\'hui et fin août...');
        const trajetsToCreate = [];
        const cityNames = Object.keys(CITIES_COORDS);
        
        const startDate = new Date();
        const endDate = new Date(startDate.getFullYear(), 7, 31); // 31 Août
        const diffTime = Math.abs(endDate - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        for (let i = 0; i < 50; i++) { // Générer 50 trajets
            let villeDepart = cityNames[Math.floor(Math.random() * cityNames.length)];
            let villeArrivee = cityNames[Math.floor(Math.random() * cityNames.length)];
            
            while (villeDepart === villeArrivee) {
                villeArrivee = cityNames[Math.floor(Math.random() * cityNames.length)];
            }
            
            const randomDaysToAdd = Math.floor(Math.random() * diffDays);
            const dateDepart = new Date();
            dateDepart.setDate(dateDepart.getDate() + randomDaysToAdd);

            const nouveauTrajet = {
                villeDepart,
                villeArrivee,
                coordsDepart: CITIES_COORDS[villeDepart],
                coordsArrivee: CITIES_COORDS[villeArrivee],
                compagnie: COMPANIES[Math.floor(Math.random() * COMPANIES.length)],
                dateDepart,
                heureDepart: HEURES_DEPART[Math.floor(Math.random() * HEURES_DEPART.length)],
                prix: (Math.floor(Math.random() * 25) + 5) * 1000, // Prix entre 5000 et 30000
                placesDisponibles: 50,
                bus: createdBuses[Math.floor(Math.random() * createdBuses.length)]._id,
                isActive: true,
            };
            trajetsToCreate.push(nouveauTrajet);
        }

        await Trajet.insertMany(trajetsToCreate);
        console.log(`✅ ${trajetsToCreate.length} trajets ont été créés avec succès.`);
        console.log('Opération de seeding terminée.');

    } catch (err) {
        console.error("❌ Une erreur est survenue lors du seeding:", err);
    } finally {
        await mongoose.disconnect();
        console.log('Connexion à MongoDB fermée.');
    }
};

seedDatabase();