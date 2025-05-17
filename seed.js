/* ─────────────────────────────────────────────
 *  seed.js — peupler la collection trajets
 *  Usage :
 *    1) npm i mongodb dotenv
 *    2) créer .env  →  MONGO_URI=...
 *    3) node seed.js       # ou  npm run seed
 * ────────────────────────────────────────────*/
require('dotenv').config()
const { MongoClient } = require('mongodb')

// 1) Connexion
const uri  = process.env.MONGO_URI
if (!uri) throw new Error('⚠️  Ajoutez MONGO_URI dans .env')
const client = new MongoClient(uri)

;(async () => {
  try {
    await client.connect()
    console.log('✅ Connected to MongoDB')

    const db      = client.db()           // la base dans l’URI (ex. transport_mali)
    const trajets = db.collection('trajets')

    // 2) Échantillon de compagnies maliennes (non exhaustif)
    const companies = [
      'Diarra Transport',
      'Bani Transport',
      'Sonef Mali',
      'Oumar Touré Voyages',
      'Bakary Trans',
      'Star Voyage',
      'African Bus Mali'
    ]

    // 3) Villes et prix de référence
    const villes = ['Bamako', 'Sikasso', 'Kayes', 'Mopti', 'Ségou', 'Gao', 'Tombouctou']
    const prixKm = 75   // FCFA/km fictif

    // 4) Générer quelques dates/heures proches
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() + i)          // J+0 … J+6
      d.setHours(0, 0, 0, 0)
      return d
    })
    const heures = ['07:00', '11:30', '14:45', '18:00']

    // 5) Fonction utilitaire distance (fictif)
    const dist = (from, to) => {
      const idx = Math.abs(villes.indexOf(from) - villes.indexOf(to)) + 1
      return idx * 100 + 50               // km approximatifs
    }

    // 6) Construit 35 trajets variés
    const docs = []
    villes.forEach(dep => {
      villes.filter(v => v !== dep).forEach(arr => {
        companies.slice(0, 4).forEach(comp => {          // 4 compagnies
          dates.slice(0, 5).forEach(date => {            // 5 prochains jours
            heures.slice(0, 2).forEach(h => {           // 2 horaires
              const prix = dist(dep, arr) * prixKm
              docs.push({
                villeDepart:  dep,
                villeArrivee: arr,
                compagnie:    comp,
                dateDepart:   date,
                heureDepart:  h,
                prix,
                placesDisponibles: 40,
                bus: {
                  numero:   `B-${Math.floor(Math.random()*900)+100}`,
                  capacite: 50
                }
              })
            })
          })
        })
      })
    })

    // 7) Purge optionnelle puis insertion
    await trajets.deleteMany({})                // commentez si vous voulez préserver l’existant
    const { insertedCount } = await trajets.insertMany(docs)
    console.log(`✅ ${insertedCount} trajets insérés.`)
  } catch (err) {
    console.error(err)
  } finally {
    await client.close()
    process.exit(0)
  }
})()
