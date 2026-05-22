// PhotoBeam WebApp relay
// Receives beam events from glasses.html and broadcasts to receiver.html
//
// Local: node server.js  →  http://localhost:3000
// Deploy: push to Railway/Render — they detect package.json automatically

require('dotenv').config();
const express = require('express');
const { WebSocketServer } = require('ws');
const http    = require('http');
const path    = require('path');

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 3000;

app.use(express.json());

// Serve the two HTML files
app.get('/',          (_, res) => res.sendFile(path.join(__dirname, '..', 'receiver.html')));
app.get('/glasses',   (_, res) => res.sendFile(path.join(__dirname, '..', 'glasses.html')));
app.get('/receiver',  (_, res) => res.sendFile(path.join(__dirname, '..', 'receiver.html')));

// HTTP fallback for beam (used when WebSocket isn't ready yet)
const browsers = new Set();

app.post('/beam', (req, res) => {
  const payload = JSON.stringify({ type: 'beam', ...req.body });
  let sent = 0;
  for (const ws of browsers) {
    if (ws.readyState === 1) { ws.send(payload); sent++; }
  }
  console.log(`[relay] beam → ${sent} browser(s)`);
  res.json({ ok: true, sent });
});

app.get('/health', (_, res) => res.json({ ok: true, browsers: browsers.size }));

// WebSocket
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', ws => {
  browsers.add(ws);
  console.log(`[relay] client connected (total: ${browsers.size})`);

  ws.on('message', data => {
    // Glasses web app sends beam directly via WebSocket
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'beam') {
        const payload = JSON.stringify(msg);
        let sent = 0;
        for (const client of browsers) {
          if (client !== ws && client.readyState === 1) {
            client.send(payload);
            sent++;
          }
        }
        console.log(`[relay] WS beam → ${sent} receiver(s)`);
      }
    } catch(_) {}
  });

  ws.on('close', () => {
    browsers.delete(ws);
    console.log(`[relay] client left (total: ${browsers.size})`);
  });
});

server.listen(PORT, () =>
  console.log(`[relay] ✓ :${PORT}  glasses→ /glasses  receiver→ /`)
);
