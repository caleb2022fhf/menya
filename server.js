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

// 2. Knowledge Base & Intelligent Scoring Engine
const knowledgeBase = [
  {
    keywords: ["irrigate", "tomato", "dry", "sun", "water", "izuba", "kuhira", "inyanya", "ubuhinzi"],
    response: "Mu buhinzi bw'inyanya cyangwa ibihhingwa mu gihe cy'izuba, inama nziza ni ugukoresha uburyo bwo kuhira bw'ibitonyanga (drip irrigation) no gupfukira ubutaka n'ibyatsi byumye (mulching) kugira ngo amazi adashira vuba."
  },
  {
    keywords: ["soil", "fertility", "compost", "manure", "uburumbuke", "butaka", "ifumbire"],
    response: "Kugira ngo wongere uburumbuke bw'ubutaka bwawe, jya ukoresha ifumbire y'imborera yatangiye kubora neza kandi ukore gahunda yo guhinduranya ibihhingwa (crop rotation) nk'ibishyimbo cyangwa amashaza."
  },
  {
    keywords: ["overtake", "curve", "bend", "hill", "kunyuranaho", "amakosi", "umuhanda", "umugina"],
    response: "Amategeko y'umuhanda arabuzanya burundu kunyuranaho (overtaking) ahantu habi nko mu ikosi riremereye, mu mpinga y'umugina, cyangwa aho utabona neza imbere yawe."
  },
  {
    keywords: ["speed", "limit", "urban", "residential", "uvuduku", "mujyi", "gucengera"],
    response: "Umuvuduku wemewe mu duce tw'imidugudu cyangwa imijyi (urban areas) ni kilometero 40 mu isaha (40 km/h) keretse niba ibyapa byerekana ikindi gipimo."
  },
  {
    keywords: ["sombe", "cassava", "leaves", "recipe", "guteka", "isombe", "ubunyobwa"],
    response: "Uburyo bwo guteka isombe iryoheye: Banza uteke amagangi y'imyumbati (isombe) yose ashya neza, wongeremo ibitunguru, tungurusumu, amavuta, n'ubunyobwa bw'umutsima kugira ngo igire uburyohe budasanzwe."
  },
  {
    keywords: ["rice", "fried", "umuceri", "imboga"],
    response: "Guteka umuceri w'imboga (fried rice): Jya ubanza uteke umuceri usanzwe wume neza. Hanyuma ukarange tungurusumu, karoti, n'ibihaza mu mavutamake, uvanze n'umuceri hamwe na soya sauce."
  }
];

function getAIResponse(userMessage) {
  const query = userMessage.toLowerCase();
  let bestMatch = "Murakoze kubaza! Menya AI iracyitoza iyi ngingo. Ushobora kumbaza ibijyanye n'ubuhinzi bushya, amategeko y'umuhanda, cyangwa ubumenyi bwo guteka.";
  let highestScore = 0;

  for (const item of knowledgeBase) {
    let score = 0;
    for (const kw of item.keywords) {
      if (query.includes(kw)) {
        score += 1;
      }
    }
    if (score > highestScore) {
      highestScore = score;
      bestMatch = item.response;
    }
  }

  return bestMatch;
}

// 3. API Endpoint
app.post('/api/ai', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Ubutumwa ntabwo burimo." });
  }

  try {
    const reply = getAIResponse(message);

    // Save chat interaction to Turso Database
    try {
      await db.execute({
        sql: "INSERT INTO ai_chats (user_message, ai_response) VALUES (?, ?)",
        args: [message, reply]
      });
    } catch (dbErr) {
      console.error("Turso DB Log Error:", dbErr);
    }

    res.json({ reply });
  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: "Habaye ikosa kuri server." });
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
