const express = require('express');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
const { createClient } = require('@libsql/client');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || '',
  authToken: process.env.TURSO_AUTH_TOKEN || '',
});

app.post('/api/ai', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Ubutumwa ntabwo burimo." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API Key irabuze muri Vercel." });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Hano niho tuyiha "Ubuhanga" cyangwa "Amahugurwa" (System Instruction)
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: message,
      config: {
        systemInstruction: `Uri umwarimu n'inzobere yigisha ubuhinzi bushya (new agriculture rules) ndetse n'amategeko y'umuhanda (driving laws). 
        Ugomba gusubiza ibibazo by'abakugana ukoresheje ubumenyi bw'ubuhinzi bugezweho n'amategeko y'umuhanda mu buryo bworoheje kandibusobanutse mu rurimi umukoresha abajijemo.`
      }
    });

    const reply = response.text || "Mbabajwe no kutabona igisubizo.";

    // Kubika muri database
    await db.execute({
      sql: "INSERT INTO ai_chats (user_message, ai_response) VALUES (?, ?)",
      args: [message, reply]
    });

    res.json({ reply });
  } catch (error) {
    console.error("AI Error:", error);
    // Fallback niba gemini-2.5-flash ihuye n'umuzigo, ikoreshe gemini-2.5-pro
    res.status(500).json({ error: `AI Error: ${error.message}` });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Menya running on port ${PORT}`));

module.exports = app;
