const express = require('express');
const cors = require('cors');
const { create, ev } = require('@open-wa/wa-automate');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;

let waClient = null;

// The available agents in the pool. In a real system, this would be fetched from Supabase.
const agents = [
  '254712345678', // Example agent 1
  '254798765432'  // Example agent 2
];

let lastAssignedAgentIndex = 0;

// Initialize the OpenWA client
create({
  sessionId: "ECOMMERCE_BOT",
  multiDevice: true, 
  authTimeout: 60,
  blockCrashLogs: true,
  disableSpins: true,
  headless: true,
  hostNotificationLang: 'EN',
  logConsole: false,
  popup: true,
  qrTimeout: 0, 
}).then(client => {
  waClient = client;
  console.log('✅ OpenWA Client Initialized successfully!');
  
  // You can set up message listeners here if you want the bot to auto-reply
  // client.onMessage(async message => { ... });
});

// Endpoint to get the best agent for checkout
app.post('/api/get-agent', async (req, res) => {
  if (!waClient) {
    return res.status(503).json({ error: 'WhatsApp client not ready yet' });
  }

  try {
    let selectedAgent = null;

    // 1. Intelligent Routing: Try to find an online agent
    for (const agent of agents) {
      const jid = `${agent}@c.us`;
      // We can use getPresence to check if they are online
      // Note: For privacy reasons, presence might not always be visible unless they are contacts and allow it
      // Alternatively, we can just assign round-robin as a fallback
      try {
        const presence = await waClient.getPresence(jid);
        if (presence === 'available' || presence === 'composing') {
          selectedAgent = agent;
          break;
        }
      } catch (e) {
        console.log(`Could not get presence for ${agent}`);
      }
    }

    // 2. Fallback: Round-Robin if no one is strictly 'online'
    if (!selectedAgent) {
      selectedAgent = agents[lastAssignedAgentIndex];
      lastAssignedAgentIndex = (lastAssignedAgentIndex + 1) % agents.length;
    }

    res.json({ success: true, agent: selectedAgent });
  } catch (error) {
    console.error('Error finding agent:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`WhatsApp Bot Service running on port ${PORT}`);
});
