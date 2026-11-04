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

    const check = await db.execute("SELECT COUNT(*) as count FROM courses");
    if (check.rows[0].count === 0) {
      await db.execute({
        sql: `INSERT INTO courses (title, video_url, description, keywords) VALUES (?, ?, ?, ?)`,
        args: [
          "Uburyo bwo Kuhira Inyanya mu Gihe cy'Izuba", 
          "https://www.youtube.com/embed/dQw4w9WgXcQ", 
          "Menya uko wakoresha drip irrigation na mulching kugira ngo inyanya zitabora mu gihe cy'izuba.", 
          "irrigate,tomato,izuba,kuhira,inyanya,ubuhinzi"
        ]
      });
    }
    console.log("Database initialized successfully.");
  } catch (err) {
    console.error("DB Error:", err);
  }
}
initDatabase();

// Admin: Kongeramo isomo
app.post('/api/admin/add-course', async (req, res) => {
  const { title, video_url, description, keywords } = req.body;
  if (!title || !video_url) {
    return res.status(400).json({ success: false, error: "Mutwe na Video URL birakenewe." });
  }

  try {
    await db.execute({
      sql: `INSERT INTO courses (title, video_url, description, keywords) VALUES (?, ?, ?, ?)`,
      args: [title, video_url, description || '', keywords || '']
    });
    res.json({ success: true, message: "Isomo ryongewemo neza!" });
  } catch (error) {
    console.error("Admin Error:", error);
    res.status(500).json({ success: false, error: "Ntibyashobokaga kubika." });
  }
});

// Student: Gushakisha isomo binyuze mu kibazo
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
      answer: bestMatch ? `Dore isomo rijyanye n'ikibazo cyawe: "${bestMatch.title}". Reba amashusho ari munsi y'iyi kugira ngo wige birambuye.` : "Nta somo riraboneka kuri iyi ngingo.",
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
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
