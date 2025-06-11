// backend/add-data.js
// Ce script AJOUTE des données (bus, trajets) sans supprimer les données existantes.

// CORRECTION : On charge les variables d'environnement.
// Sans chemin, dotenv cherche un fichier .env dans le répertoire courant.
require('dotenv').config(); 
const mongoose = require('mongoose');
const Trajet = require('./models/trajet.model'); // Assurez-vous que le chemin vers vos modèles est correct
const Bus = require('./models/bus.model');

// --- Données à Ajouter ---
const nouvellesVilles = [
    { nom: 'Tombouctou', coords: { lat: 16.7735, lng: -3.0074 } },
    { nom: 'Gao', coords: { lat: 16.2666, lng: -0.0400 } },
    { nom: 'Kidal', coords: { lat: 18.4411, lng: 1.4078 } },
    { nom: 'Taoudénit', coords: { lat: 22.6736, lng: -3.9781 } },
    { nom: 'Ménaka', coords: { lat: 15.9182, lng: 2.4014 } },
    { nom: 'Dioïla', coords: { lat: 12.4939, lng: -6.7461 } },
    { nom: 'Niono', coords: { lat: 14.2526, lng: -5.9930 } },
    { nom: 'Kita', coords: { lat: 13.0444, lng: -9.4895 } },
    { nom: 'Douentza', coords: { lat: 15.0019, lng: -2.9497 } },
    { nom: 'Bandiagara', coords: { lat: 14.3499, lng: -3.6101 } },
    { nom: 'San', coords: { lat: 13.3045, lng: -4.8955 } },
    { nom: 'Koutiala', coords: { lat: 12.3917, lng: -5.4642 } },
    { nom: 'Goundam', coords: { lat: 16.4144, lng: -3.6708 } },
    { nom: 'Nara', coords: { lat: 15.1681, lng: -7.2863 } },
    { nom: 'Bougouni', coords: { lat: 11.4194, lng: -7.4817 } },
];

const nouveauxBus = [
    { numero: 'N-505', etat: 'en service', capacite: 52 },
    { numero: 'N-606', etat: 'en service', capacite: 50 },
    { numero: 'S-707', etat: 'en service', capacite: 60 },
];

const nouvellesCompagnies = ['Sogatra', 'Dounia-Tia', 'Gana-Transport'];

// --- Logique du Script ---

const addData = async () => {
    // Vérification de la présence de MONGODB_URI
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) {
        console.error('❌ Erreur: La variable MONGODB_URI n\'a pas été trouvée dans votre fichier .env');
        process.exit(1);
    }
  
    try {
        // 1. Connexion à la base de données
        await mongoose.connect(mongoURI);
        console.log('✅ Connecté à MongoDB');

        // 2. Ajouter les nouveaux bus s'ils n'existent pas déjà
        console.log('Vérification et ajout de nouveaux bus...');
        let busAjoutes = 0;
        for (const busData of nouveauxBus) {
            const existingBus = await Bus.findOne({ numero: busData.numero });
            if (!existingBus) {
                await new Bus(busData).save();
                busAjoutes++;
            }
        }
        console.log(`✅ ${busAjoutes} nouveaux bus ajoutés.`);

        // 3. Récupérer tous les bus "en service" pour les assigner aux trajets
        const allBuses = await Bus.find({ etat: 'en service' });
        if (allBuses.length === 0) {
            throw new Error("Aucun bus 'en service' disponible pour créer de nouveaux trajets.");
        }

        // 4. Créer une liste complète des villes disponibles pour les trajets
        const villesExistantes = [
            { nom: 'Bamako', coords: { lat: 12.6392, lng: -8.0029 } },
            { nom: 'Sikasso', coords: { lat: 11.3176, lng: -5.6665 } },
            { nom: 'Kayes', coords: { lat: 14.4469, lng: -11.4443 } },
            { nom: 'Mopti', coords: { lat: 14.4944, lng: -4.1970 } },
            { nom: 'Ségou', coords: { lat: 13.4317, lng: -6.2658 } },
        ];
        const allCityData = [...villesExistantes, ...nouvellesVilles]
            .filter((v, i, a) => a.findIndex(t => t.nom === v.nom) === i); // Dédoublonnage

        // 5. Générer de nouveaux trajets
        console.log('Génération de nouveaux trajets...');
        const trajetsACreer = [];
        for (let i = 0; i < 15; i++) {
            const villeDepartData = allCityData[Math.floor(Math.random() * allCityData.length)];
            let villeArriveeData = allCityData[Math.floor(Math.random() * allCityData.length)];
            
            while (villeArriveeData.nom === villeDepartData.nom) {
                villeArriveeData = allCityData[Math.floor(Math.random() * allCityData.length)];
            }
            
            const dateDepart = new Date();
            dateDepart.setUTCDate(dateDepart.getUTCDate() + Math.floor(Math.random() * 14) + 1);

            const nouveauTrajet = {
                villeDepart: villeDepartData.nom,
                villeArrivee: villeArriveeData.nom,
                coordsDepart: villeDepartData.coords,
                coordsArrivee: villeArriveeData.coords,
                compagnie: nouvellesCompagnies[Math.floor(Math.random() * nouvellesCompagnies.length)],
                dateDepart,
                heureDepart: ['07:30', '09:00', '16:00'][Math.floor(Math.random() * 3)],
                prix: (Math.floor(Math.random() * 15) + 5) * 1000,
                placesDisponibles: 50,
                bus: allBuses[Math.floor(Math.random() * allBuses.length)]._id,
                isActive: true,
            };
            trajetsACreer.push(nouveauTrajet);
        }

        const result = await Trajet.insertMany(trajetsACreer);
        console.log(`✅ ${result.length} nouveaux trajets ont été créés et ajoutés.`);

    } catch (err) {
        console.error("❌ Une erreur est survenue lors de l'ajout des données:", err);
    } finally {
        await mongoose.disconnect();
        console.log('Connexion à MongoDB fermée.');
    }
};

// Lancement du script
addData();