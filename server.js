const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
// Serve static files from the public folder
app.use(express.static(path.join(__dirname, 'public')));

// RAG AI Endpoint
app.post('/api/ask-menya', async (req, res) => {
  try {
    const { question } = req.body;

    // Simulated RAG context matching uploaded driving & agriculture PDFs
    const retrievedContext = `
      Article 45: Speed limit inside Kigali city is strictly set to 40 km/h.
      Solar Inverter Setup: For 12V 1000W loads, use 4 AWG copper wire.
      Agriculture: Intercrop maize with climbing beans every 3 months for optimal nitrogen.
    `;

    // DeepSeek API call
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "You are Menya AI for Rwanda. Answer strictly based on course context."
          },
          {
            role: "user",
            content: `Context: ${retrievedContext}\n\nQuestion: ${question}`
          }
        ]
      })
    });

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || "According to Rwandan regulations: " + question;

    res.json({ success: true, answer });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fallback to index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Menya app running on port ${PORT}`);
});
