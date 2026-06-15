const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

const AUTH_FOLDER = '/data/auth';

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
      console.log('==========================================');
      console.log('📱 QR KODU - WhatsApp > Linked Devices > Link a Device ilə skan et');
      console.log('==========================================');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('⚠️ Bağlantı bağlandı. Yenidən qoşulma:', shouldReconnect);
      if (shouldReconnect) startBot();
    } else if (connection === 'open') {
      console.log('✅ WhatsApp-a qoşuldu!');
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
console.log('🚀 Bot başladılır...');
