// El test y el expect de Playwright que usan todos los E2E: const { test, expect } = require('../soporte/fixtures');
// Agrega una sola cosa: cada página manda al back de prueba (puerto 8090) lo que el front le pide a localhost:8000.
// Así los E2E no chocan con el back de desarrollo ni con Docker, que suelen estar en el 8000.
const base = require('@playwright/test');
const { URL_BACK, URL_BACK_DEL_FRONT } = require('./entorno');

const test = base.test.extend({
  // La página de siempre, con la redirección al back de prueba ya puesta
  page: async ({ page }, use) => {
    await page.route(`${URL_BACK_DEL_FRONT}/**`, (ruta) =>
      ruta.continue({ url: ruta.request().url().replace(URL_BACK_DEL_FRONT, URL_BACK) }),
    );
    await use(page);
  },
});

module.exports = { test, expect: base.expect };
