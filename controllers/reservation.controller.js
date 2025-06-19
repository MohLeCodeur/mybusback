// backend/controllers/reservation.controller.js
const mongoose = require('mongoose');
const axios = require('axios');
const crypto = require('crypto');
const Reservation = require('../models/reservation.model');
const Trajet = require('../models/trajet.model');

// Sélection de l'endpoint API de VitePay en fonction de l'environnement
const VITEPAY_API = process.env.NODE_ENV === 'production'
  ? 'https://api.vitepay.com/v1/prod/payments'
  : 'https://api.vitepay.com/v1/test/payments';

/**
 * @desc    Créer une réservation et initier le paiement VitePay
 * @route   POST /api/reservations
 * @access  Privé (client connecté)
 */
// backend/controllers/reservation.controller.js

// ... (imports)

// Remplacez cette fonction dans backend/controllers/reservation.controller.js

exports.createReservationAndPay = async (req, res) => {
  const session = await mongoose.startSession();
  let reservation, trajet, passagers;

  try {
    session.startTransaction();

    const { trajetId, contactEmail, contactTelephone } = req.body;
    passagers = req.body.passagers; 
    
    const placesReservees = passagers.length;

    if (!trajetId || !passagers || placesReservees === 0 || !contactEmail || !contactTelephone) {
      throw new Error('Tous les champs sont requis.');
    }
    if (!req.user) {
      throw new Error('Utilisateur non authentifié.');
    }

    trajet = await Trajet.findById(trajetId).session(session);
    if (!trajet) throw new Error('Trajet non trouvé.');
    if (trajet.placesDisponibles < placesReservees) {
      throw new Error(`Seulement ${trajet.placesDisponibles} places disponibles.`);
    }

    reservation = new Reservation({
      trajet: trajetId,
      client: req.user._id,
      passagers,
      placesReservees,
      statut: 'en_attente'
    });
    await reservation.save({ session });

    trajet.placesDisponibles -= placesReservees;
    await trajet.save({ session });

    await session.commitTransaction();

  } catch (err) {
    await session.abortTransaction();
    console.error('Erreur lors de la transaction DB:', err.message);
    return res.status(400).json({ message: err.message });
  } finally {
    session.endSession();
  }

  try {
    const order_id = reservation._id.toString();
    const montantFCFA = trajet.prix * reservation.placesReservees;
    const amount_100 = montantFCFA * 100;
    const callback_url = `${process.env.BACKEND_URL}/api/vitepay/callback`;
    const return_url = `${process.env.FRONTEND_URL}/confirmation/${order_id}`;
    const decline_url = `${process.env.FRONTEND_URL}/payment-failed`;
    const cancel_url = `${process.env.FRONTEND_URL}/search`;

    const rawString = `${order_id};${amount_100};XOF;${callback_url};${process.env.VITEPAY_API_SECRET}`.toUpperCase();
    const hash = crypto.createHash('sha1').update(rawString).digest('hex');

    // --- CORRECTION DE L'IP ---
    const forwardedIps = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const buyerIp = forwardedIps.split(',')[0].trim();
    // -------------------------

    const payload = {
      payment: {
        order_id,
        language_code: 'fr',
        currency_code: 'XOF',
        country_code: 'ML',
        p_type: 'orange_money',
        description: `Réservation #${order_id}`,
        amount_100,
        return_url,
        decline_url,
        cancel_url,
        callback_url,
        buyer_ip_adress: buyerIp, // Utilisation de l'IP nettoyée
        email: req.body.contactEmail,
        buyer_name: `${passagers[0].prenom} ${passagers[0].nom}`,
        buyer_phone_number: req.body.contactTelephone,
      },
      redirect: 0,
      api_key: process.env.VITEPAY_API_KEY,
      hash,
      ...(process.env.NODE_ENV !== 'production' ? { is_test: 1 } : {})
    };

    console.log('→ Payload envoyé à VitePay:', JSON.stringify(payload, null, 2));
    const response = await axios.post(VITEPAY_API, payload, { headers: { 'Content-Type': 'application/json' } });
    console.log('← Réponse de VitePay:', response.data);

    const checkoutUrl = response.data.redirect_url || response.data;
    if (!checkoutUrl) throw new Error('URL de paiement non valide reçue de VitePay.');
    
    return res.status(201).json({ reservationId: order_id, checkoutUrl });

  } catch (err) {
    if (err.response) {
      console.error('Erreur API VitePay - Statut:', err.response.status);
      console.error('Erreur API VitePay - Corps:', err.response.data);
    } else {
      console.error('Erreur de requête vers VitePay:', err.message);
    }
    return res.status(500).json({ message: 'Impossible d’initialiser le paiement auprès de notre partenaire.' });
  }
};

// ... Le reste du fichier (getReservationByIdPublic, getAllReservationsAdmin, etc.)
// ne change pas. Vous n'avez qu'à remplacer la fonction createReservationAndPay.

// Le reste des fonctions (pour l'admin et la confirmation) reste identique
// ...
exports.getReservationByIdPublic = async (req, res) => {
    try {
        // --- VÉRIFIEZ ET CORRIGEZ CETTE PARTIE ---
        const reservation = await Reservation.findById(req.params.id)
            .populate('client', 'nom prenom email') // Peuple le client
            .populate({
                path: 'trajet', // Peuple le trajet...
                populate: {
                    path: 'bus', // ...et à l'intérieur, peuple le bus
                    model: 'Bus'
                }
            });
        // ------------------------------------------

        if (!reservation) {
            return res.status(404).json({ message: "Réservation non trouvée" });
        }
        
        // Vérification de sécurité
        if (reservation.client._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ message: "Accès non autorisé à cette réservation." });
        }
        
        res.json(reservation);
    } catch (err) {
        console.error("Erreur getReservationByIdPublic:", err);
        res.status(500).json({ message: err.message });
    }
};

exports.getAllReservationsAdmin = async (req, res) => {
  try {
    const { statut } = req.query; // ex: 'confirmée', 'en_attente'
    let queryFilter = {};

    if (statut && ['confirmée', 'en_attente', 'annulée'].includes(statut)) {
        queryFilter.statut = statut;
    }

    const list = await Reservation.find(queryFilter)
      .populate('client', 'prenom nom email')
      .populate({
        path: 'trajet',
        select: 'villeDepart villeArrivee dateDepart prix', // On ne récupère que les champs utiles
        populate: { path: 'bus', select: 'numero' }
      })
      .sort({ dateReservation: -1 });

    res.json(list);
  } catch (err) {
    console.error("Erreur getAllReservationsAdmin:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.updateReservationAdmin = async (req, res) => {
  try {
    // On ne met à jour que les champs fournis dans le body
    const { statut } = req.body;
    if (!statut) {
        return res.status(400).json({ message: "Aucun statut fourni pour la mise à jour." });
    }

    const reservation = await Reservation.findByIdAndUpdate(
      req.params.id, 
      { statut: statut }, // On s'assure de ne changer que le statut
      { new: true, runValidators: true }
    );

    if (!reservation) {
      return res.status(404).json({ message: "Réservation non trouvée" });
    }
    
    console.log(`Réservation ${reservation._id} mise à jour manuellement au statut: ${reservation.statut}`);
    res.json(reservation);

  } catch (err) {
    console.error("Erreur updateReservationAdmin:", err);
    res.status(500).json({ message: err.message });
  }
};
exports.confirmReservationManually = async (req, res) => {
    try {
        const reservation = await Reservation.findById(req.params.id);
        if (!reservation) {
            return res.status(404).json({ message: "Réservation non trouvée" });
        }

        // Si la réservation est déjà confirmée, on ne fait rien
        if (reservation.statut === 'confirmée') {
            return res.status(400).json({ message: "Cette réservation est déjà confirmée." });
        }

        reservation.statut = 'confirmée';
        await reservation.save();
        
        // C'est ici que vous ajouteriez la logique pour mettre à jour les statistiques.
        // Pour l'instant, les statistiques sont calculées à la volée, donc le simple
        // fait de changer le statut est suffisant. Si vous aviez une collection
        // 'revenus_mensuels', vous l'incrémenteriez ici.

        console.log(`Réservation ${reservation._id} confirmée manuellement par un admin.`);
        res.json({ message: "Réservation confirmée avec succès.", reservation });

    } catch (err) {
        console.error("Erreur confirmReservationManually:", err);
        res.status(500).json({ message: err.message });
    }
};

exports.deleteReservationAdmin = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    
    // 1. Trouver la réservation à supprimer
    const reservation = await Reservation.findById(id).session(session);
    if (!reservation) {
      throw new Error("Réservation non trouvée.");
    }

    // 2. Si la réservation était confirmée, on libère les places
    if (reservation.statut === 'confirmée') {
      await Trajet.findByIdAndUpdate(
        reservation.trajet,
        { $inc: { placesDisponibles: reservation.placesReservees } }, // Incrémente les places
        { session }
      );
      console.log(`Places libérées pour le trajet ${reservation.trajet}`);
    }

    // 3. Supprimer la réservation
    const deletedReservation = await Reservation.findByIdAndDelete(id, { session });
    if (!deletedReservation) {
      // Cette erreur ne devrait pas arriver si le findById a fonctionné, mais c'est une sécurité
      throw new Error("La suppression a échoué.");
    }

    // 4. Valider la transaction
    await session.commitTransaction();
    
    res.json({ message: "Réservation supprimée avec succès et places libérées." });

  } catch (err) {
    // En cas d'erreur, tout est annulé
    await session.abortTransaction();
    console.error("Erreur deleteReservationAdmin:", err);
    res.status(err.message.includes("non trouvée") ? 404 : 500).json({ message: err.message });
  } finally {
    session.endSession();
  }
};