const express = require('express');
const path = require('path');
const { createClient } = require('@libsql/client');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || '',
  authToken: process.env.TURSO_AUTH_TOKEN || '',
});

async function initDatabase() {
  try {
    // Table y'amasomo ya video
    await db.execute(`
      CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        video_url TEXT,
        description TEXT,
        keywords TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Turemye amakuru y'ibanze niba nta na rimwe ririmo
    const check = await db.execute("SELECT COUNT(*) as count FROM courses");
    if (check.rows[0].count === 0) {
      await db.execute({
        sql: `INSERT INTO courses (title, video_url, description, keywords) VALUES (?, ?, ?, ?)`,
        args: [
          "Uburyo bwo Kuhira Inyanya mu Gihe cy'Izuba", 
          "https://www.youtube.com/embed/sample-irrigation", 
          "Menya uko wakoresha drip irrigation na mulching kugira ngo inyanya zitabora mu gihe cy'izuba.", 
          "irrigate,tomato,izuba,kuhira,inyanya,ubuhinzi"
        ]
      });
    }

    console.log("Turso Database initialized for Admin & Courses.");
  } catch (err) {
    console.error("DB Error:", err);
  }
}
initDatabase();

// --- ADMIN API: Kongeramo isomo rya video nshya ---
app.post('/api/admin/add-course', async (req, res) => {
  const { title, video_url, description, keywords } = req.body;
  if (!title || !video_url) {
    return res.status(400).json({ error: "Mutwe wa video na Link birakenewe." });
  }

  try {
    await db.execute({
      sql: `INSERT INTO courses (title, video_url, description, keywords) VALUES (?, ?, ?, ?)`,
      args: [title, video_url, description || '', keywords || '']
    });
    res.json({ success: true, message: "Isomo rya video ryongewemo neza!" });
  } catch (error) {
    console.error("Admin Error:", error);
    res.status(500).json({ error: "Ntibyashobokaga kubika isomo." });
  }
});

// --- STUDENT/USER API: Gushakisha amasomo no gusubiza ibibazo byerekeye video ---
app.post('/api/student/ask', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Injiza ikibazo." });

  try {
    const query = message.toLowerCase();
    const result = await db.execute("SELECT * FROM courses");
    const courses = result.rows;

    let bestMatch = courses[0];
    let highestScore = 0;

    for (const course of courses) {
      const kws = (course.keywords || '').toLowerCase().split(',');
      let score = 0;
      for (const kw of kws) {
        if (kw.trim() && query.includes(kw.trim())) {
          score += 1;
        }
      }
      if (score > highestScore) {
        highestScore = score;
        bestMatch = course;
      }
    }

    res.json({ 
      answer: bestMatch ? `Hura n'isomo rijyanye n'ikibazo cyawe: "${bestMatch.title}". Reba video iri munsi y'iyi kugira ngo umenye ibisobanuro birambuye.` : "Nta somo riraboneka kuri iyi ngingo.",
      course: bestMatch 
    });
  } catch (error) {
    console.error("Search Error:", error);
    res.status(500).json({ error: "Habaye ikosa." });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Menya Platform running on port ${PORT}`));

module.exports = app;
