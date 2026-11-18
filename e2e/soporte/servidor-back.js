// El back de prueba de los E2E. Lo levanta Playwright (webServer en playwright.config.js): node soporte/servidor-back.js
//  1. arma la base alojamiento_e2e desde cero con los datos de ejemplo (scripts/preparar-e2e.php del back), así cada
//     ejecución empieza igual sin importar lo que dejó la anterior;
//  2. levanta el back con php -S en 127.0.0.1:8000, con las variables de entorno.variablesBack() (pagos simulados).
const { execFileSync, spawn } = require('node:child_process');
const path = require('node:path');
const { carpetaBack, variablesBack, php, PUERTO_BACK } = require('./entorno');

const back = carpetaBack();
const env = { ...process.env, ...variablesBack() };

execFileSync(php, [path.join('scripts', 'preparar-e2e.php')], { cwd: back, stdio: 'inherit', env });

const servidor = spawn(php, ['-S', `127.0.0.1:${PUERTO_BACK}`, '-t', 'index'], { cwd: back, stdio: 'inherit', env });
servidor.on('exit', (codigo) => process.exit(codigo ?? 0));

// Cuando Playwright termina, apaga también el php -S
for (const senial of ['SIGINT', 'SIGTERM']) {
  process.on(senial, () => servidor.kill());
}
