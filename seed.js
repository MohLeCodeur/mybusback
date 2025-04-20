require('dotenv').config();
const mongoose = require('mongoose');
const Trajet = require('./models/Trajet');
const Reservation = require('./models/Reservation');

const villes = ['Bamako', 'Sikasso', 'Ségou', 'Mopti', 'Kayes', 'Koulikoro', 'Gao', 'Tombouctou'];

async function seedDB() {
  try {
    console.log('Tentative de connexion à MongoDB Atlas...');
    
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });

    console.log('✅ Connecté à MongoDB Atlas');

    // Nettoyage de la base
    console.log('Nettoyage de la base de données...');
    await Trajet.deleteMany({});
    await Reservation.deleteMany({});

    // Création des trajets
    const trajets = [];
    for (let i = 0; i < 20; i++) {
      const villeDepart = villes[Math.floor(Math.random() * villes.length)];
      let villeArrivee;
      do {
        villeArrivee = villes[Math.floor(Math.random() * villes.length)];
      } while (villeArrivee === villeDepart);

      const trajet = new Trajet({
        villeDepart,
        villeArrivee,
        dateDepart: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000),
        heureDepart: `${Math.floor(Math.random() * 24)}:${Math.random() > 0.5 ? '00' : '30'}`,
        prix: 5000 + Math.floor(Math.random() * 20000),
        placesDisponibles: 10 + Math.floor(Math.random() * 40),
        bus: {
          numero: `BUS-${1000 + i}`,
          capacite: 50
        }
      });

      await trajet.save();
      trajets.push(trajet);
      console.log(`Trajet créé: ${villeDepart} → ${villeArrivee}`);
    }

    console.log(`✅ ${trajets.length} trajets créés avec succès`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur lors du seeding:', err.message);
    console.error('Détails techniques:', err);
    process.exit(1);
  }
}

seedDB();