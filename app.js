// backend/app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { Server } = require("socket.io");
const connectDB = require('./config/db');

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

// --- JOB D'AUTOMATISATION RETIRÉ ---
// La section 'setInterval(updateColisStatuses, ...)' a été complètement supprimée.

// --- Démarrage du serveur ---
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré (HTTP & WebSocket) sur le port ${PORT}`);
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
  res.json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});