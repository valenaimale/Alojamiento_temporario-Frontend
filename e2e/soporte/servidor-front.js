// Un servidor estático mínimo para el front (lo mismo que Live Server o "python3 -m http.server 5500"), sin dependencias.
// Lo levanta Playwright (webServer en playwright.config.js): node soporte/servidor-front.js
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { RAIZ_FRONT, PUERTO_FRONT } = require('./entorno');

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

// Responde cada pedido con el archivo del repo del front; nunca sale de esa carpeta
function atender(pedido, respuesta) {
  const ruta = decodeURIComponent(new URL(pedido.url, 'http://localhost').pathname);
  let archivo = path.normalize(path.join(RAIZ_FRONT, ruta));
  if (!archivo.startsWith(RAIZ_FRONT)) {
    respuesta.writeHead(403).end();
    return;
  }
  if (fs.existsSync(archivo) && fs.statSync(archivo).isDirectory()) archivo = path.join(archivo, 'index.html');
  fs.readFile(archivo, (error, contenido) => {
    if (error) {
      respuesta.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('No existe');
      return;
    }
    respuesta.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo).toLowerCase()] || 'application/octet-stream' });
    respuesta.end(contenido);
  });
}

http.createServer(atender).listen(PUERTO_FRONT, 'localhost', () => {
  console.log(`Front de prueba en http://localhost:${PUERTO_FRONT}`);
});
