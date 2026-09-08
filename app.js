require('dotenv').config();
const express = require('express');
const path = require('path');
const { generatResponse } = require('./helper');
const app = express();

// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files (CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));
// Middleware for parsing JSON bodies
app.use(express.json());

// Global messages array to keep track of chat history
let messages = [];

// Routes
app.get('/', (req, res) => {
  res.render('index', { title: 'Mausam Chatbot' });
});

app.get('/messages', (req, res) => {
  res.json(messages);
});

app.post('/message', (req, res) => {
  const userMessage = req.body.message;
  
  if (userMessage) {
    // Add user message to array
    messages.push({ sender: 'USER', message: userMessage });

    messages.push({ sender: 'BOT', message: '......thinking 🤔' });

    callLLM(messages);
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, error: 'Message content is required' });
  }
});

callLLM=function(){
    generatResponse(messages);
}
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at ${PORT}`);
});