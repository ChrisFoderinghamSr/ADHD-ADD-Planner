/* Optional local server. The app also opens directly from index.html. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' };
http.createServer((req, res) => {
  let name;
  try { name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
  const target = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
  if (!target.startsWith(root + path.sep) || !['.html', '.css', '.js', '.svg', '.json'].includes(path.extname(target))) { res.writeHead(404).end(); return; }
  fs.readFile(target, (error, data) => {
    if (error) { res.writeHead(404).end('File not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(target)], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(data);
  });
}).listen(4173, '127.0.0.1', () => console.log('Daylight is ready at http://127.0.0.1:4173'));
