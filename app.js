// backend/app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const connectDB = require('./config/db');

// --- Connexion DB ---
connectDB();

const app = express();

// --- Middlewares ---
app.use(express.json());
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(helmet());
app.use(morgan('dev')); // Très utile pour voir les requêtes entrantes !

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200
});
app.use(limiter);


// =======================================================
// --- DÉFINITION DES ROUTES (STRUCTURE CORRIGÉE) ---
// =======================================================

// 1. Routes d'Authentification (publiques)
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/dashboard', require('./routes/dashboard.routes.js'));
// 2. Routes Publiques (recherche, suivi...)
app.use('/api/public/trajets', require('./routes/public/trajet.routes'));
app.use('/api/public/colis', require('./routes/public/colis.routes'));

// 3. Routes Protégées pour les clients connectés (réservation)
app.use('/api/reservations', require('./routes/reservation.routes'));
app.use('/api/payments/vitepay', require('./routes/vitepay.routes'));
app.use('/api/tracking', require('./routes/tracking.routes.js'));
// 4. Routes Administratives (toutes préfixées par /api/admin)
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
  res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

// --- Démarrage ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré en mode ${process.env.NODE_ENV} sur le port ${PORT}`);
});