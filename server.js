const express = require('express');
const path = require('path');
const { containerBootstrap } = require('@nlpjs/basic');
const { Nlp } = require('@nlpjs/basic');
const { LangEn } = require('@nlpjs/lang-en-min');
const { createClient } = require('@libsql/client');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. Setup Turso Database Connection
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || '',
  authToken: process.env.TURSO_AUTH_TOKEN || '',
});

async function initDatabase() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS ai_chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_message TEXT,
        ai_response TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Turso Database initialized successfully.");
  } catch (err) {
    console.error("Database Init Error:", err);
  }
}
initDatabase();

// 2. Setup and Train Custom Predictive AI Engine
let nlpInstance = null;

async function setupCustomAI() {
  const container = containerBootstrap();
  container.register('lang-en', new LangEn());
  const nlp = new Nlp({ container, languages: ['en'] });

  // --- TRAINING DATASET: AGRICULTURE ---
  nlp.addDocument('en', 'how to irrigate tomato crops during dry season', 'agri.irrigation');
  nlp.addDocument('en', 'what is the best watering system for farming in drought', 'agri.irrigation');
  nlp.addDocument('en', 'how to protect crops from hot weather and sun', 'agri.irrigation');
  nlp.addAnswer('en', 'agri.irrigation', 'For dry season farming, use drip irrigation directly at the roots and apply soil mulching (covering soil with dry leaves) to retain moisture and prevent evaporation.');

  nlp.addDocument('en', 'how to increase soil fertility organically', 'agri.fertilizer');
  nlp.addDocument('en', 'best organic fertilizer for vegetables', 'agri.fertilizer');
  nlp.addAnswer('en', 'agri.fertilizer', 'Use well-decomposed compost manure and practice crop rotation with legumes (beans/peas) to fix natural nitrogen into your soil.');

  // --- TRAINING DATASET: DRIVING LAWS ---
  nlp.addDocument('en', 'can I overtake on a sharp curve or bend', 'driving.overtaking');
  nlp.addDocument('en', 'is it legal to pass another car near a hill or turn', 'driving.overtaking');
  nlp.addDocument('en', 'rules for overtaking vehicles on narrow roads', 'driving.overtaking');
  nlp.addAnswer('en', 'driving.overtaking', 'Overtaking is strictly prohibited on sharp bends, blind curves, crests of hills, or anywhere visibility of oncoming traffic is restricted.');

  nlp.addDocument('en', 'what is the speed limit in urban residential areas', 'driving.speed');
  nlp.addDocument('en', 'how fast can I drive in city streets', 'driving.speed');
  nlp.addAnswer('en', 'driving.speed', 'The standard speed limit in urban areas and near built-up residential zones is 40 km/h unless posted speed signs specify otherwise.');

  // --- TRAINING DATASET: COOKING ---
  nlp.addDocument('en', 'how to cook delicious cassava leaves sombe', 'cooking.sombe');
  nlp.addDocument('en', 'recipe for traditional sombe with groundnuts', 'cooking.sombe');
  nlp.addAnswer('en', 'cooking.sombe', 'To prepare traditional Sombe: Boil ground cassava leaves thoroughly. Add chopped onions, garlic, celery, sunflower oil, and thick groundnut paste. Simmer over low heat until fully tender.');

  nlp.addDocument('en', 'how to prepare healthy fried rice with vegetables', 'cooking.rice');
  nlp.addDocument('en', 'recipe for cooking fried rice', 'cooking.rice');
  nlp.addAnswer('en', 'cooking.rice', 'Sauté minced garlic, carrots, and sweet peas in light oil. Add pre-cooked cold rice, soy sauce, and stir-fry on high heat for 3-5 minutes until evenly combined.');

  await nlp.train();
  nlpInstance = nlp;
  console.log("Custom Menya AI Engine trained and ready for predictions!");
}

setupCustomAI();

// 3. API Endpoint for Menya Custom AI
app.post('/api/ai', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Ubutumwa ntabwo burimo." });
  }

  if (!nlpInstance) {
    return res.status(500).json({ error: "AI Engine is still initializing, please try again in a moment." });
  }

  try {
    // Process input message and predict intent
    const response = await nlpInstance.process('en', message);

    let reply = response.answer;
    if (!reply || response.score < 0.5) {
      reply = "Murakoze kumpa iki kibazo! Ubu Menya AI ntitarafata amakuru ahagije kuri iyi ngingo. Nyamuneka yongere muri dataset yacu y'ubuhinzi, umuhanda, cyangwa guteka!";
    }

    // Save chat interaction to Turso Database
    try {
      await db.execute({
        sql: "INSERT INTO ai_chats (user_message, ai_response) VALUES (?, ?)",
        args: [message, reply]
      });
    } catch (dbErr) {
      console.error("Turso DB Log Error:", dbErr);
    }

    res.json({ reply, intent: response.intent, confidence: response.score });
  } catch (error) {
    console.error("Prediction Engine Error:", error);
    res.status(500).json({ error: "Server Prediction Error." });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Menya Custom AI running on port ${PORT}`);
});

module.exports = app;
