const express = require('express');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
const { createClient } = require('@libsql/client');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Turso Database
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
    console.log("Database initialized.");
  } catch (err) {
    console.error("DB Init Error:", err);
  }
}
initDatabase();

// AI Chat Endpoint with Automatic Backup Models
app.post('/api/ai', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Ubutumwa ntabwo burimo." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is missing in Vercel settings." });
  }

  const ai = new GoogleGenAI({ apiKey });
  
  // Jerageza gukoresha Pro niba Flash ihuze, cyangwa Flash niba Pro ihuze
  const availableModels = ['gemini-2.5-pro', 'gemini-2.5-flash'];
  let reply = null;
  let lastError = null;

  for (const modelName of availableModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: message,
      });

      if (response && response.text) {
        reply = response.text;
        break; // Yakunze! Hagarika gushakisha izindi.
      }
    } catch (err) {
      console.warn(`Model ${modelName} failed, trying next... Error:`, err.message);
      lastError = err.message;
    }
  }

  if (!reply) {
    return res.status(500).json({ error: `AI System busy: ${lastError}` });
  }

  // Save to Turso Database
  try {
    await db.execute({
      sql: "INSERT INTO ai_chats (user_message, ai_response) VALUES (?, ?)",
      args: [message, reply]
    });
  } catch (dbErr) {
    console.error("Turso DB Error:", dbErr);
  }

  res.json({ reply });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Menya server running on port ${PORT}`);
});

module.exports = app;
