import { NFC } from 'nfc-pcsc';
import { WebSocketServer } from 'ws';

// Configuration
const WS_PORT = 8999;

// Initialize WebSocket Server
const wss = new WebSocketServer({ port: WS_PORT });

console.log(`[NFC Middleware] WebSocket Server running on ws://localhost:${WS_PORT}`);

wss.on('connection', (ws) => {
    console.log('[WS] Client connected');
    ws.send(JSON.stringify({ type: 'STATUS', message: 'Connected to NFC Middleware' }));

    ws.on('close', () => console.log('[WS] Client disconnected'));
});

// Broadcast helper
function broadcast(data) {
    wss.clients.forEach((client) => {
        if (client.readyState === 1) { // OPEN
            client.send(JSON.stringify(data));
        }
    });
}

// Initialize NFC
console.log('[NFC] Initializing PCSC...');
const nfc = new NFC();

nfc.on('reader', (reader) => {
    console.log(`[NFC] Reader found: ${reader.name}`);
    broadcast({ type: 'READER_STATUS', status: 'connected', name: reader.name });

    reader.on('card', (card) => {
        const uid = card.uid;
        console.log(`[NFC] Card detected! UID: ${uid}`);

        // Send UID to all connected clients (The Frontend)
        broadcast({ type: 'CARD_SCAN', uid: uid });
    });

    reader.on('card.off', (card) => {
        console.log('[NFC] Card removed');
    });

    reader.on('error', (err) => {
        console.error(`[NFC] Reader error:`, err);
    });

    reader.on('end', () => {
        console.log(`[NFC] Reader removed: ${reader.name}`);
        broadcast({ type: 'READER_STATUS', status: 'disconnected' });
    });
});

nfc.on('error', (err) => {
    console.error('[NFC] Error:', err);
    console.log('---');
    console.log('NOTE: If you see "PCSC not found" or build errors, ensure you have drivers installed.');
});

// Heartbeat to keep connections alive
setInterval(() => {
    broadcast({ type: 'PING' });
    // Log connected clients count for debugging
    const clientCount = wss.clients.size;
    // console.log(`[System] Active clients: ${clientCount}`); 
}, 30000); // Every 30 seconds

