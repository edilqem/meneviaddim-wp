const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const qrcode = require('qrcode');

const AUTH_FOLDER = '/data/auth';

let currentQR = null;
let connectionStatus = 'Bağlanır...';

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQR = qr;
      connectionStatus = '📱 QR kodu skan et';
      console.log('🔑 Yeni QR kod yarandı - veb səhifəyə bax');
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      connectionStatus = '⚠️ Bağlantı bağlandı, yenidən qoşulur...';
      console.log(connectionStatus);
      if (shouldReconnect) startBot();
    } else if (connection === 'open') {
      currentQR = null;
      connectionStatus = '✅ WhatsApp-a qoşuldu!';
      console.log(connectionStatus);
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // Gələn mesajları izlə - ID-ləri tapmaq üçün
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

    console.log(`📩 Mesaj: "${text}" | Chat ID: ${from}`);

    if (text.trim() === '/test') {
      await sock.sendMessage(from, { text: `✅ Bot işləyir!\n\nBu çatın ID-si:\n${from}` });
    }
  });
}

startBot();

// ---- QR kodu göstərmək üçün veb səhifə ----
const app = express();

app.get('/', async (req, res) => {
  if (currentQR) {
    const qrImage = await qrcode.toDataURL(currentQR);
    res.send(`
      <html>
        <head><meta http-equiv="refresh" content="15"></head>
        <body style="text-align:center; font-family:sans-serif; padding-top:40px;">
          <h2>${connectionStatus}</h2>
          <img src="${qrImage}" style="width:300px;height:300px;" />
          <p>WhatsApp → Linked Devices → Link a Device → bu kodu skan et</p>
          <p>Kod köhnəlibsə səhifə özü yenilənəcək (15 san)</p>
        </body>
      </html>
    `);
  } else {
    res.send(`
      <html>
        <head><meta http-equiv="refresh" content="5"></head>
        <body style="text-align:center; font-family:sans-serif; padding-top:40px;">
          <h2>${connectionStatus}</h2>
        </body>
      </html>
    `);
  }
});

app.listen(process.env.PORT || 3000, () => console.log('🌐 Veb server işə düşdü'));

console.log('🚀 Bot başladılır...');
