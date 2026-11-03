const express = require('express');
const path = require('path');
const { createClient } = require('@libsql/client');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Guhuza na Turso Database
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || '',
  authToken: process.env.TURSO_AUTH_TOKEN || '',
});

// Gukora Tables muri Database niba zitariho
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
    console.log("Database tables initialized.");
  } catch (err) {
    console.error("Database initialization error:", err);
  }
}
initDatabase();

// API Endpoint yo kuvugana na Gemini AI
app.post('/api/ai', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Ubutumwa ntabwo burimo." });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Gemini API Key ntabwo yashyizwe muri Environment Variables." });
    }

    // Twakoresheje gemini-2.5-flash (cyangwa ushobora gushyiramo gemini-2.0-flash)
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: message }] }]
      })
    });

    const data = await response.json();
    
    if (data.error) {
      console.error("Gemini API Error:", data.error);
      return res.status(500).json({ error: `AI Error: ${data.error.message}` });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Mbabajwe no kubabwira ko ntashoboye kubona igisubizo.";

    // Kubika muri Turso Database (Niba yananiwe kubika ntibibuza AI gusubiza)
    try {
      await db.execute({
        sql: "INSERT INTO ai_chats (user_message, ai_response) VALUES (?, ?)",
        args: [message, reply]
      });
    } catch (dbErr) {
      console.error("Turso DB Insert Error:", dbErr);
    }

    res.json({ reply });
  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: "Habaye ikibazo gikomeye muri Server." });
  }
});

// Serve frontend routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server Menya is running on port ${PORT}`);
});

module.exports = app;
