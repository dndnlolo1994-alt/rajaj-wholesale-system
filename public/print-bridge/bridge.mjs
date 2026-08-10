#!/usr/bin/env node

import { createServer } from 'node:http';
import { Socket } from 'node:net';

const PORT = Number(process.argv[2] ?? process.env.BRIDGE_PORT ?? 9723);

function sendToPrinter(ip, port, data) {
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('Printer connection timed out'));
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
        if (!ip || !data) throw new Error('Printer IP and data are required');
        const bytes = Buffer.from(data, 'base64');
        console.log(`[${new Date().toLocaleTimeString()}] Print -> ${ip}:${port ?? 9100} (${(bytes.length / 1024).toFixed(1)} KB)`);
        await sendToPrinter(ip, Number(port) || 9100, bytes);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        console.log('  OK printed');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Print failed';
        console.error(`  ERROR ${message}`);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, () => {
  console.log('==============================================');
  console.log('  Rajaei Printer Bridge is running');
  console.log(`  Bridge URL: http://127.0.0.1:${PORT}`);
  console.log('  Keep this window open while printing.');
  console.log('  Stop: Ctrl+C');
  console.log('==============================================');
});
