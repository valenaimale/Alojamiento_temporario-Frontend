// Configuración de Playwright para los E2E de HayLugar. Cómo correrlos y cómo escribir uno nuevo: e2e/README.md.
// Playwright levanta solo el back (con una base propia y los pagos simulados) y el front, y los apaga al terminar.
const { defineConfig, devices } = require('@playwright/test');
const { URL_FRONT, PUERTO_BACK } = require('./soporte/entorno');

const enCi = Boolean(process.env.CI);

module.exports = defineConfig({
  testDir: './tests',
  // Todos los tests comparten una base: de a uno, para que un test no le cambie los datos a otro mientras corre
  workers: 1,
  fullyParallel: false,
  // En el CI, un test.only olvidado hace fallar la ejecución en lugar de saltear el resto
  forbidOnly: enCi,
  // En el CI se reintenta una vez: si pasa al segundo intento, el reporte lo marca como "flaky" para revisarlo
  retries: enCi ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: enCi ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: URL_FRONT,
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
    // Si un test falla, quedan la traza (paso a paso, con capturas), la captura final y el video, en el reporte HTML
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // El back de prueba: arma la base alojamiento_e2e y levanta php -S (soporte/servidor-back.js)
      command: 'node soporte/servidor-back.js',
      url: `http://127.0.0.1:${PUERTO_BACK}/estado`,
      // Nunca reusar un back que ya esté corriendo: sería el de desarrollo, con la base de cada uno
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      // El front, servido tal cual está en el repo (soporte/servidor-front.js)
      command: 'node soporte/servidor-front.js',
      url: `${URL_FRONT}/vistas/homes/index-sin-sesion.html`,
      reuseExistingServer: !enCi,
      timeout: 30_000,
    },
  ],
});
