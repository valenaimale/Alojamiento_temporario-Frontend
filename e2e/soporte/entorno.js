// Dónde está cada cosa que necesitan los E2E: el repo del back, PHP, los puertos y las variables del back de prueba.
// Lo usan playwright.config.js (para levantar los servidores) y preparar.js (para armar la base).
const fs = require('node:fs');
const path = require('node:path');

const RAIZ_FRONT = path.resolve(__dirname, '..', '..');

// El repo del back: E2E_BACK_DIR, o el lugar donde suele estar en la máquina de cada uno
function carpetaBack() {
  const candidatos = [
    process.env.E2E_BACK_DIR,
    path.resolve(RAIZ_FRONT, '..', '..', 'Back', 'Alojamiento_temporario-Backend'),
    path.resolve(RAIZ_FRONT, '..', 'Alojamiento_temporario-Backend'),
  ].filter(Boolean);
  const encontrado = candidatos.find((carpeta) => fs.existsSync(path.join(carpeta, 'scripts', 'preparar-e2e.php')));
  if (!encontrado) {
    throw new Error(
      'No encontré el repo del back con scripts/preparar-e2e.php. Indicá dónde está con la variable E2E_BACK_DIR. Probé:\n  '
        + candidatos.join('\n  '),
    );
  }
  return encontrado;
}

// El front de prueba se sirve en localhost:5500: sesion.js lo reconoce como desarrollo y le habla al back en localhost:8000.
// El back de prueba NO usa el 8000 (ahí suele estar el back de desarrollo de cada uno, o Docker): corre en el 8090, y
// soporte/fixtures.js redirige ahí lo que el front le pide a localhost:8000. Mismo host, así que las cookies valen igual.
const PUERTO_FRONT = 5500;
const PUERTO_BACK = Number(process.env.E2E_PUERTO_BACK || 8090);
const URL_FRONT = `http://localhost:${PUERTO_FRONT}`;
const URL_BACK_DEL_FRONT = 'http://localhost:8000';
const URL_BACK = `http://localhost:${PUERTO_BACK}`;

// Las variables con las que corre el back de prueba. Tienen prioridad sobre config/configuracion.php de cada uno:
// base aislada, sesiones en archivos, pagos simulados (sin MetaMask ni Base Sepolia) y mails a Mailpit, nunca a Brevo.
function variablesBack() {
  const variables = {
    DB_NAME: process.env.E2E_DB_NAME || 'alojamiento_e2e',
    SESIONES_DRIVER: 'archivos',
    SESIONES_COOKIE_SEGURA: '0',
    APP_URL_FRONT: URL_FRONT,
    PAGOS_VERIFICADOR: 'simulado',
    PAGOS_FIRMADOR: 'simulado',
    MAIL_TRANSPORTE: 'smtp',
  };
  // en el CI no hay phinx.php: los datos de MySQL llegan por E2E_DB_*
  for (const [e2e, back] of [['E2E_DB_HOST', 'DB_HOST'], ['E2E_DB_PORT', 'DB_PORT'], ['E2E_DB_USER', 'DB_USER'], ['E2E_DB_PASS', 'DB_PASS']]) {
    if (process.env[e2e] !== undefined) variables[back] = process.env[e2e];
  }
  return variables;
}

module.exports = {
  RAIZ_FRONT, PUERTO_FRONT, PUERTO_BACK, URL_FRONT, URL_BACK, URL_BACK_DEL_FRONT, carpetaBack, variablesBack, php: process.env.E2E_PHP || 'php',
};
