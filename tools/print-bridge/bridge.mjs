#!/usr/bin/env node
// =====================================================================
// جسر الطباعة المحلي — نظام رجائي المصري
// =====================================================================
// المتصفح لا يستطيع فتح اتصال TCP مباشر مع الطابعة الحرارية الشبكية،
// لذلك يعمل هذا الجسر الصغير على أي جهاز في نفس شبكة الطابعة (كمبيوتر
// المحل مثلًا) ويستقبل أوامر ESC/POS من النظام ويمررها للطابعة.
//
// التشغيل:   npm run print-bridge
// أو:        node tools/print-bridge/bridge.mjs [port]
// الافتراضي: يستمع على المنفذ 9723
//
// ثم في النظام: الإعدادات ← الطابعة ← طريقة الطباعة "مباشرة عبر الجسر"
// وضع عنوان الجسر http://<IP-هذا-الجهاز>:9723 وعنوان الطابعة ومنفذها (9100 عادة).
//
// لا اعتماديات خارجية — Node.js فقط.
// =====================================================================

import { createServer } from 'node:http';
import { Socket } from 'node:net';

const PORT = Number(process.argv[2] ?? process.env.BRIDGE_PORT ?? 9723);

function sendToPrinter(ip, port, data) {
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('انتهت مهلة الاتصال بالطابعة'));
    }, 10000);

    socket.connect(port, ip, () => {
      socket.write(data, (err) => {
        clearTimeout(timeout);
        if (err) {
          socket.destroy();
          reject(err);
          return;
        }
        socket.end(() => resolve());
      });
    });
    socket.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

const server = createServer((req, res) => {
  // CORS — النظام يستدعي الجسر من المتصفح
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'rajaei-print-bridge', version: 1 }));
    return;
  }

  if (req.method === 'POST' && req.url === '/print') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 8 * 1024 * 1024) req.destroy();
    });
    req.on('end', async () => {
      try {
        const { ip, port, data } = JSON.parse(body);
        if (!ip || !data) throw new Error('ip وdata مطلوبان');
        const bytes = Buffer.from(data, 'base64');
        console.log(`[${new Date().toLocaleTimeString()}] طباعة → ${ip}:${port ?? 9100} (${(bytes.length / 1024).toFixed(1)} KB)`);
        await sendToPrinter(ip, Number(port) || 9100, bytes);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        console.log('  ✓ تمت الطباعة');
      } catch (err) {
        console.error(`  ✗ ${err.message}`);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, () => {
  console.log('==============================================');
  console.log('  جسر الطباعة — نظام رجائي المصري');
  console.log(`  يستمع على المنفذ: ${PORT}`);
  console.log('  اتركه يعمل، وفي إعدادات النظام ضع:');
  console.log(`  عنوان الجسر: http://<IP-هذا-الجهاز>:${PORT}`);
  console.log('  إيقاف: Ctrl+C');
  console.log('==============================================');
});
