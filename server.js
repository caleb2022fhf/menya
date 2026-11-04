const express = require('express');
const path = require('path');
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
    // Turemye table y'ibiganiro
    await db.execute(`
      CREATE TABLE IF NOT EXISTS ai_chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_message TEXT,
        ai_response TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Turemye table y'ubumenyi (Knowledge Base) yigenga kandi yibuka
    await db.execute(`
      CREATE TABLE IF NOT EXISTS knowledge_base (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keywords TEXT,
        response TEXT
      )
    `);

    // Niba table irimo ubusa, dushyiramo ubumenyi bw'ibanze (Seed Data)
    const check = await db.execute("SELECT COUNT(*) as count FROM knowledge_base");
    if (check.rows[0].count === 0) {
      await db.execute({
        sql: "INSERT INTO knowledge_base (keywords, response) VALUES (?, ?)",
        args: ["irrigate,tomato,dry,sun,water,izuba,kuhira,inyanya,ubuhinzi", "Mu buhinzi bw'inyanya cyangwa ibihinga mu gihe cy'izuba, inama nziza ni ugukoresha uburyo bwo kuhira bw'ibitonyanga (drip irrigation) no gupfukira ubutaka n'ibyatsi byumye (mulching)."]
      });
      await db.execute({
        sql: "INSERT INTO knowledge_base (keywords, response) VALUES (?, ?)",
        args: ["overtake,curve,bend,hill,kunyuranaho,amakosi,umuhanda", "Amategeko y'umuhanda arabuzanya burundu kunyuranaho ahantu habi nko mu ikosi riremereye cyangwa aho utabona neza."]
      });
      await db.execute({
        sql: "INSERT INTO knowledge_base (keywords, response) VALUES (?, ?)",
        args: ["sombe,cassava,leaves,recipe,guteka,isombe", "Uburyo bwo guteka isombe iryoheye: Banza uteke amagangi y'imyumbati yose ashya neza, wongeremo ibitunguru, tungurusumu, amavuta, n'ubunyobwa."]
      });
      console.log("Default knowledge base seeded into Turso.");
    }

    console.log("Turso Database initialized successfully.");
  } catch (err) {
    console.error("Database Init Error:", err);
  }
}
initDatabase();

// 2. Intelligent Scoring Engine isoma muri Turso Database
async function getAIResponse(userMessage) {
  const query = userMessage.toLowerCase();
  let bestMatch = "Murakoze kubaza! Menya AI iracyitoza iyi ngingo. Ushobora kuyigisha iyi nshya cyangwa ukabaza ibindi.";
  let highestScore = 0;

  try {
    // SOMA UBUMENYI BWOSE BURI MURI TURSO DATABASE
    const result = await db.execute("SELECT * FROM knowledge_base");
    const knowledgeBase = result.rows;

    for (const item of knowledgeBase) {
      const keywords = item.keywords.split(',');
      let score = 0;
      for (const kw of keywords) {
        if (query.includes(kw.trim().toLowerCase())) {
          score += 1;
        }
      }
      if (score > highestScore) {
        highestScore = score;
        bestMatch = item.response;
      }
    }
  } catch (err) {
    console.error("Error reading knowledge base:", err);
  }

  return bestMatch;
}

// 3. API Endpoint yo gusubiza
app.post('/api/ai', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Ubutumwa ntabwo burimo." });
  }

  try {
    const reply = await getAIResponse(message);

    // Bika amateka muri Turso
    await db.execute({
      sql: "INSERT INTO ai_chats (user_message, ai_response) VALUES (?, ?)",
      args: [message, reply]
    });

    res.json({ reply });
  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: "Habaye ikosa kuri server." });
  }
});

// 4. API Endpoint NSHYA yo kwigisha AI (Teach AI Autonomous Endpoint)
app.post('/api/teach', async (req, res) => {
  const { keywords, response } = req.body;
  if (!keywords || !response) {
    return res.status(400).json({ error: "Injiza keywords n'igisubizo." });
  }

  try {
    await db.execute({
      sql: "INSERT INTO knowledge_base (keywords, response) VALUES (?, ?)",
      args: [keywords, response]
    });
    res.json({ success: true, message: "Menya AI yize ikintu gishya kandi ikibitse burundu!" });
  } catch (error) {
    console.error("Teach Error:", error);
    res.status(500).json({ error: "Ntibyashobokaga kwigisha AI." });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Menya Autonomous AI running on port ${PORT}`);
});

module.exports = app;
