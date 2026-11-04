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

// AI Chat Endpoint
app.post('/api/ai', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Ubutumwa ntabwo burimo." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is missing in Vercel settings." });
  }

  try {
    // Initialize official Google Gen AI SDK
    const ai = new GoogleGenAI({ apiKey });

    // Call gemini-2.5-flash via SDK
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: message,
    });

    const reply = response.text || "Mbabajwe no kubabwira ko ntashoboye kubona igisubizo.";

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
  } catch (error) {
    console.error("Gemini SDK Error:", error);
    res.status(500).json({ error: `AI Error: ${error.message || 'Failed to communicate with AI'}` });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Menya server running on port ${PORT}`);
});

module.exports = app;
