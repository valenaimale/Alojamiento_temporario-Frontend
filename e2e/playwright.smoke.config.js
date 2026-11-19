// Configuración del smoke de producción: unos pocos tests de solo lectura contra la app desplegada (Vercel + Railway +
// Aiven), para saber si quedó viva después de un deploy. No levanta servidores ni toca la base de prueba.
// Se corre con: npx playwright test -c playwright.smoke.config.js   (ver e2e/README.md, sección "Smoke de producción")
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './smoke',
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  // La red de producción puede tener un mal momento: se reintenta dos veces antes de dar el deploy por roto
  retries: 2,
  // El back de Railway puede tardar en responder la primera vez (arranque en frío)
  timeout: 60_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    // SMOKE_URL permite probar otro despliegue (por ejemplo, una preview de Vercel)
    baseURL: process.env.SMOKE_URL || 'https://alojamientotemporario-frontend.vercel.app',
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
