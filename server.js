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

    // Hano tuyihaye ubuhanga bwo kwigisha ubuhinzi, amategeko y'umuhanda, ndetse no guteka
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: message,
      config: {
        systemInstruction: `Uri umwarimu n'inzobere yigisha ibintu bitatu by'ingenzi:
        1. Ubuhinzi bushya na kijyambere (new agriculture rules and practices).
        2. Amategeko y'umuhanda n'uburyo bwo gutwara ibinyabiziga neza (driving laws).
        3. Ubumenyi bwo guteka (cooking recipes and culinary skills).
        Subiza ibibazo by'abakugana ukoresheje izi ngingo zose mu rurimi rwa Kinyarwanda mu buryo bworoheje, bufatika kandi busobanutse neza.`
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
    res.status(500).json({ error: `AI Error: ${error.message}` });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Menya running on port ${PORT}`));

module.exports = app;
