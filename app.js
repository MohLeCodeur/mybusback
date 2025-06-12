// backend/app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http'); // Import du module HTTP natif de Node.js
const { Server } = require("socket.io"); // Import de la classe Server de socket.io
const connectDB = require('./config/db');

// --- Connexion à la base de données ---
connectDB();

const app = express();
// On crée un serveur HTTP à partir de notre application Express.
// C'est nécessaire pour que socket.io puisse s'y attacher.
const server = http.createServer(app);

// --- Configuration de Socket.IO ---
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173", // Autorise les connexions depuis notre frontend
    methods: ["GET", "POST"]
  }
});

// Cet objet stockera les utilisateurs connectés en temps réel
// Format: { "userId1": "socketId1", "userId2": "socketId2" }
let onlineUsers = {};

io.on('connection', (socket) => {
  console.log(`🔌 Nouvel utilisateur connecté avec le socket ID: ${socket.id}`);

  // Le client enverra cet événement avec son ID utilisateur après s'être connecté
  socket.on('addNewUser', (userId) => {
    onlineUsers[userId] = socket.id;
    // On peut envoyer la liste des utilisateurs en ligne à tous les clients si besoin
    // io.emit("getOnlineUsers", Object.keys(onlineUsers));
    console.log("Utilisateurs actuellement en ligne:", onlineUsers);
  });

  socket.on('disconnect', () => {
    // Retirer l'utilisateur de la liste à la déconnexion
    for (const userId in onlineUsers) {
      if (onlineUsers[userId] === socket.id) {
        delete onlineUsers[userId];
        break;
      }
    }
    // io.emit("getOnlineUsers", Object.keys(onlineUsers));
    console.log(`🔥 Utilisateur déconnecté: ${socket.id}. Utilisateurs restants:`, onlineUsers);
  });
});
// ------------------------------------


// --- Middlewares Globaux ---
app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(helmet());
app.use(morgan('dev')); // Affiche les requêtes HTTP dans la console

// Middleware pour rendre 'io' et 'onlineUsers' accessibles dans les contrôleurs
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

// Routes Administratives
app.use('/api/admin/bus', require('./routes/admin/bus.routes'));
app.use('/api/admin/chauffeurs', require('./routes/admin/chauffeur.routes'));
app.use('/api/admin/trajets', require('./routes/admin/trajet.routes'));
app.use('/api/admin/reservations', require('./routes/admin/reservation.routes'));
app.use('/api/admin/colis', require('./routes/admin/colis.routes'));
app.use('/api/admin/stats', require('./routes/admin/stats.routes'));
app.use('/api/admin/paiements', require('./routes/admin/paiement.routes.js'));
app.use('/api/admin/villes', require('./routes/admin/ville.routes'));


// --- Gestion des Erreurs ---
app.use((req, res, next) => {
  const error = new Error(`Non trouvé - ${req.originalUrl}`);
  res.status(404);
  next(error);
});
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);
  res.json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});


// --- Démarrage du serveur ---
const PORT = process.env.PORT || 5000;
// On utilise 'server.listen' au lieu de 'app.listen' pour démarrer le serveur HTTP
// qui gère à la fois Express et Socket.IO.
server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré (HTTP & WebSocket) en mode ${process.env.NODE_ENV} sur le port ${PORT}`);
});