require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

// Initialisation de l'application Express
const app = express();

// Middlewares de sécurité
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000'
}));

// Logger des requêtes HTTP
app.use(morgan('dev'));

// Limiteur de requêtes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limite chaque IP à 100 requêtes par fenêtre
});
app.use(limiter);

// Middleware pour parser le JSON
app.use(express.json({ limit: '10kb' }));

// Configuration MongoDB Atlas
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://mohxl:Mohxl.777@cluster0.vapi0jr.mongodb.net/transport_mali?retryWrites=true&w=majority';

// Options de connexion améliorées
const mongooseOptions = {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  retryWrites: true,
  retryReads: true,
  maxPoolSize: 10,
  minPoolSize: 2
};

// Connexion à MongoDB avec gestion d'erreur
const connectDB = async () => {
  try {
    console.log('⌛ Tentative de connexion à MongoDB Atlas...');
    
    await mongoose.connect(MONGODB_URI, mongooseOptions);
    
    console.log('✅ Connecté avec succès à MongoDB Atlas');
    console.log(`📁 Base de données: ${mongoose.connection.name}`);
    console.log(`🖥️  Hôte: ${mongoose.connection.host}`);
  } catch (err) {
    console.error('❌ Échec de la connexion à MongoDB Atlas:', err.message);
    console.error('🔧 Détails techniques:', err);
    process.exit(1);
  }
};

// Événements de connexion
mongoose.connection.on('connected', () => {
  console.log('🔄 Mongoose est connecté à MongoDB Atlas');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Erreur de connexion Mongoose:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ Mongoose est déconnecté');
});

// Routes
const reservationRouter = require('./routes/reservations');
const trajetRouter = require('./routes/trajets');

app.use('/api/reservations', reservationRouter);
app.use('/api/trajets', trajetRouter);

// Route de santé
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date()
  });
});

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({
    status: 'fail',
    message: `Route ${req.originalUrl} non trouvée`
  });
});

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
  console.error('🔥 Erreur:', err.stack);
  
  res.status(err.statusCode || 500).json({
    status: 'error',
    message: err.message || 'Une erreur est survenue'
  });
});

// Port d'écoute
const PORT = process.env.PORT || 5000;

// Démarrage du serveur seulement si la DB est connectée
const startServer = async () => {
  await connectDB();
  
  app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
    console.log(`🌿 Environnement: ${process.env.NODE_ENV || 'development'}`);
  });
};

// Gestion des arrêts propres
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('⏹️ Application terminée (SIGINT)');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await mongoose.connection.close();
  console.log('⏹️ Application terminée (SIGTERM)');
  process.exit(0);
});

// Démarrage de l'application
startServer();