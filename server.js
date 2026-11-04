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
        category TEXT,
        video_url TEXT,
        description TEXT,
        keywords TEXT
      )
    `);

    // Shyiramo amasomo y'ibanze y'ubuhinzi na video zayo
    const check = await db.execute("SELECT COUNT(*) as count FROM courses");
    if (check.rows[0].count === 0) {
      await db.execute({
        sql: `INSERT INTO courses (title, category, video_url, description, keywords) VALUES (?, ?, ?, ?, ?)`,
        args: [
          "Uburyo bwo Kuhira Inyanya mu Gihe cy'Izuba", 
          "ubuhinzi", 
          "https://www.youtube.com/embed/sample-irrigation", 
          "Menya uko wakoresha drip irrigation na mulching kugira ngo inyanya zituma ziba nziza mu gihe cy'izuba.", 
          "irrigate,tomato,izuba,kuhira,inyanya,ubuhinzi"
        ]
      });
      await db.execute({
        sql: `INSERT INTO courses (title, category, video_url, description, keywords) VALUES (?, ?, ?, ?, ?)`,
        args: [
          "Guteza Imbere Uburumbuke bw'Ubutaka n'Ifumbire", 
          "ubuhinzi", 
          "https://www.youtube.com/embed/sample-soil", 
          "Uburyo bwo gutunganya ubutaka, gukoresha imborera no guhinduranya ibihingwa.", 
          "soil,fertility,compost,manure,uburumbuke,butaka,ifumbire"
        ]
      });
      console.log("Courses seeded into Turso.");
    }
  } catch (err) {
    console.error("DB Error:", err);
  }
}
initDatabase();

// API yo gushakisha isomo rijyanye n'ikibazo cy'umukoresha
app.post('/api/get-course', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Injiza ubutumwa." });

  try {
    const query = message.toLowerCase();
    const result = await db.execute("SELECT * FROM courses");
    const courses = result.rows;

    let bestMatch = courses[0]; // Isomo ry'ibanze
    let highestScore = 0;

    for (const course of courses) {
      const kws = course.keywords.split(',');
      let score = 0;
      for (const kw of kws) {
        if (query.includes(kw.trim().toLowerCase())) {
          score += 1;
        }
      }
      if (score > highestScore) {
        highestScore = score;
        bestMatch = course;
      }
    }

    res.json({ course: bestMatch });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Habaye ikosa." });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Menya E-Learning running on port ${PORT}`));

module.exports = app;
