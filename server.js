const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());

// Serves all static content from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint for Menya AI Chatbot
app.post('/api/ask-menya', (req, res) => {
  try {
    const { question } = req.body;
    const answer = "Aha ni igisubizo cya Menya AI ku kibazo cyawe: " + (question || "");
    res.json({ success: true, answer });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fallback to index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Vercel deployment handler
module.exports = app;
