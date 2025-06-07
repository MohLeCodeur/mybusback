// backend/app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const connectDB = require('./config/db');

// --- Connexion à la base de données ---
connectDB();

const app = express();

// --- Middlewares ---
app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(helmet());
app.use(morgan('dev'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200 // Limite chaque IP à 200 requêtes par fenêtre
});
app.use(limiter);

// --- Définition des Routes ---
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/trajets', require('./routes/trajet.routes'));
app.use('/api/reservations', require('./routes/reservation.routes'));
app.use('/api/vitepay', require('./routes/vitepay.routes'));
app.use('/api/colis', require('./routes/colis.routes')); // Pour la recherche publique de colis
app.use('/api/bus', require('./routes/bus.routes'));
app.use('/api/chauffeurs', require('./routes/chauffeur.routes'));
app.use('/api/stats', require('./routes/stats.routes'));
app.use('/api/villes', require('./routes/ville.routes'));


// --- Gestion des Erreurs ---
// 404 Not Found
app.use((req, res, next) => {
  const error = new Error(`Non trouvé - ${req.originalUrl}`);
  res.status(404);
  next(error);
});

// Gestionnaire d'erreurs global
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
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré en mode ${process.env.NODE_ENV} sur le port ${PORT}`);
});