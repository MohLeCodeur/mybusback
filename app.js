// backend/app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { Server } = require("socket.io");
const connectDB = require('./config/db');

// Import des modèles nécessaires pour le job d'automatisation
const Colis = require('./models/colis.model');
const Trajet = require('./models/trajet.model');

// --- Connexion à la base de données ---
connectDB();

const app = express();
const server = http.createServer(app);

// --- Configuration de Socket.IO ---
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

let onlineUsers = {};
io.on('connection', (socket) => {
  console.log(`🔌 Utilisateur connecté: ${socket.id}`);
  socket.on('addNewUser', (userId) => {
    onlineUsers[userId] = socket.id;
    console.log("Utilisateurs en ligne:", onlineUsers);
  });
  socket.on('disconnect', () => {
    for (const userId in onlineUsers) {
      if (onlineUsers[userId] === socket.id) delete onlineUsers[userId];
    }
    console.log(`🔥 Utilisateur déconnecté: ${socket.id}`);
  });
});

// --- Middlewares Globaux ---
app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(helmet());
app.use(morgan('dev'));

app.use((req, res, next) => {
    req.io = io;
    req.onlineUsers = onlineUsers;
    next();
});

// --- Définition des Routes ---
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/public/trajets', require('./routes/public/trajet.routes'));
app.use('/api/public/colis', require('./routes/public/colis.routes'));
app.use('/api/reservations', require('./routes/reservation.routes'));
app.use('/api/payments/vitepay', require('./routes/vitepay.routes'));
app.use('/api/dashboard', require('./routes/dashboard.routes.js'));
app.use('/api/tracking', require('./routes/tracking.routes.js'));
app.use('/api/admin/bus', require('./routes/admin/bus.routes'));
app.use('/api/admin/chauffeurs', require('./routes/admin/chauffeur.routes'));
app.use('/api/admin/trajets', require('./routes/admin/trajet.routes'));
app.use('/api/admin/reservations', require('./routes/admin/reservation.routes'));
app.use('/api/admin/colis', require('./routes/admin/colis.routes'));
app.use('/api/admin/stats', require('./routes/admin/stats.routes'));
app.use('/api/admin/paiements', require('./routes/admin/paiement.routes.js'));
app.use('/api/admin/villes', require('./routes/admin/ville.routes'));

// --- JOB D'AUTOMATISATION DU STATUT DES COLIS ---
const JOB_INTERVAL_MS = 5 * 60 * 1000; // Toutes les 5 minutes

const updateColisStatuses = async () => {
    console.log(`[JOB] Exécution de la mise à jour des statuts de colis...`);
    const now = new Date();
    
    try {
        // 1. Trouver les colis "enregistrés" liés à des trajets qui ont démarré
        const colisToStart = await Colis.find({ statut: 'enregistré' })
            .populate({
                path: 'trajet',
                match: { dateDepart: { $lte: now } }
            });

        for (const colis of colisToStart) {
            if (colis.trajet) { // La condition de populate assure que seuls ceux avec un trajet démarré sont ici
                colis.statut = 'encours';
                await colis.save();
                console.log(`[JOB] Colis ${colis.code_suivi} mis à "en cours".`);
                // TODO: Envoyer une notification socket.io à l'expéditeur
            }
        }

        // 2. Trouver les colis "en cours" liés à des trajets qui devraient être terminés
        const colisToFinish = await Colis.find({ statut: 'encours' }).populate('trajet');
            
        for (const colis of colisToFinish) {
            if (colis.trajet && colis.trajet.dateDepart) {
                const departureTime = new Date(colis.trajet.dateDepart).getTime();
                // Utiliser une durée fixe (ex: 5h) ou, mieux, une durée stockée sur le trajet
                const estimatedDurationMs = (colis.trajet.duree_estimee_min || 300) * 60 * 1000; 
                const estimatedArrivalTime = new Date(departureTime + estimatedDurationMs);

                if (now >= estimatedArrivalTime) {
                    colis.statut = 'arrivé';
                    await colis.save();
                    console.log(`[JOB] Colis ${colis.code_suivi} mis à "arrivé".`);
                    // TODO: Envoyer une notification socket.io à l'expéditeur ET au destinataire
                }
            }
        }
    } catch (error) {
        console.error("[JOB] Erreur lors de la mise à jour des statuts de colis:", error);
    }
};

// --- Démarrage du serveur et du job ---
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré (HTTP & WebSocket) sur le port ${PORT}`);
  // Lancer le job immédiatement au démarrage, puis toutes les 5 minutes
  updateColisStatuses(); 
  setInterval(updateColisStatuses, JOB_INTERVAL_MS);
});


// --- Gestion des Erreurs ---
app.use((req, res, next) => {
  const error = new Error(`Non trouvé - ${req.originalUrl}`);
  res.status(404);
  next(error);
});
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);
  res.json({ message: err.message });
});