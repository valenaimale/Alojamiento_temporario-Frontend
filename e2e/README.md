# Tests de punta a punta (E2E) con Playwright

Estos tests abren un navegador de verdad (Chromium) y usan HayLugar como un usuario: inician sesión, buscan, reservan, pagan. Prueban el front, el back y la base juntos.

Playwright hace todo solo:

1. Arma una base propia, `alojamiento_e2e`, con los datos de ejemplo del back (`db/seeds/DatosDeEjemplo.php`). Tu base de desarrollo y la de PHPUnit no se tocan.
2. Levanta el back en el puerto **8090** con el **pago simulado**: el botón dice "Pagar (simulado)" y no se abre MetaMask.
3. Levanta el front en `localhost:5500`, corre los tests y apaga todo al terminar.

Tu back de desarrollo puede seguir corriendo en el 8000: los tests redirigen al 8090 lo que el front le pide al 8000.

## Qué necesitás

- El repo del back clonado, con `composer install` hecho y `phinx.php` apuntando a tu MySQL **local**.
  - Si el back está en `../../Back/Alojamiento_temporario-Backend` o en `../Alojamiento_temporario-Backend` (respecto del front), se encuentra solo.
  - Si no, indicá la carpeta con la variable `E2E_BACK_DIR`.
- MySQL local prendido.
- Node 24.

## Cómo se corren

La primera vez, dentro de `e2e/`:

```bash
npm install
npx playwright install chromium
```

Después, siempre dentro de `e2e/`:

| Comando | Qué hace |
| --- | --- |
| `npx playwright test` | Corre todos los tests |
| `npx playwright test busqueda` | Corre solo los archivos que tienen "busqueda" en el nombre |
| `npx playwright test --headed` | Corre con el navegador a la vista |
| `npx playwright test --ui` | Abre la interfaz de Playwright: elegís un test y lo ves paso a paso |
| `npx playwright show-report` | Abre el reporte HTML de la última ejecución, con traza, captura y video de los que fallaron |
| `npx playwright codegen localhost:5500/vistas/homes/index-sin-sesion.html` | Graba lo que hacés en el navegador y lo escribe como código (sirve para encontrar selectores) |

En Windows con PowerShell, una variable se pone así: `$env:E2E_BACK_DIR = "C:\ruta\al\back"`.

En el CI (`.github/workflows/ci.yml`, job "Tests de punta a punta") corren en cada push y en cada PR. El reporte queda como artefacto `reporte-playwright` en el resumen de la ejecución.

## Cómo está armado

```text
e2e/
  playwright.config.js    configuración: servidores, navegador, reportes
  paginas/                Page Objects: una clase por pantalla
    PaginaInicio.js         inicio sin sesión, con el buscador
    PaginaInicioSesion.js   inicio de sesión
    PaginaListado.js        resultados de la búsqueda
    PaginaDetalle.js        detalle del alojamiento, calendario y Reservar
    PaginaPago.js           pago de seña, saldo o extensión
    PaginaMisReservas.js    Mis reservas
    PaginaAgenda.js         agenda del operador
    PaginaRegistro.js       formularios de registro y "Revisá tu mail"
    PaginaVerificarMail.js  el enlace del mail que crea la cuenta
    PaginaLiquidacionesBackoffice.js  liquidaciones del backoffice: generar y pagar
    PaginaGrupal.js         detalle de una reserva grupal: elegir unidades y reservar
    PaginaGrupalesAdministrador.js  reservas grupales del administrador
  tests/                  un archivo por flujo
  soporte/
    fixtures.js           el test y el expect que usan todos los tests
    datos.js              usuarios, unidades y fechas de los datos de ejemplo
    entorno.js            puertos, carpeta del back, variables del back de prueba
    servidor-back.js      arma la base y levanta el back de prueba
    servidor-front.js     sirve el front
```

## Datos de ejemplo

Todos los usuarios tienen la contraseña `clave-segura-1` y el mail verificado. Están en `soporte/datos.js`:

| Clave en `datos.js` | Usuario | Rol |
| --- | --- | --- |
| `huesped` | Juan Pérez | huésped |
| `otraHuesped` | Lucía Sosa | huésped (tiene una reserva confirmada que ingresa en 6 días, con el saldo pendiente que vence mañana) |
| `propietaria` | Marisa Gómez | propietaria, no discrimina IVA |
| `propietariaConIva` | Elsa Quiroga | propietaria, discrimina IVA |
| `administrador` | Cacho Fernández | administrador |
| `operadora` | Nadia Ruiz | operadora |
| `backoffice` | Rocío Paz | backoffice (genera y paga las liquidaciones) |

Las unidades, sus precios y sus fechas ocupadas están comentadas en `soporte/datos.js`. Si necesitás otro dato de partida, se agrega al seeder del back y se documenta ahí.

## Cómo escribir un test nuevo

El más corto que hay, `tests/mis-reservas.spec.js`:

```javascript
// Mis reservas: el historial muestra las estadías que ya terminaron.
const { test, expect } = require('../soporte/fixtures');
const { PaginaInicioSesion } = require('../paginas/PaginaInicioSesion');
const { PaginaMisReservas } = require('../paginas/PaginaMisReservas');

// Juan tiene dos estadías finalizadas en los datos de ejemplo (Cabaña del Mar y Casa del Bosque)
test('el historial muestra las estadías finalizadas del huésped', async ({ page }) => {
  // Arrange
  await new PaginaInicioSesion(page).ingresarComo('huesped');
  const misReservas = new PaginaMisReservas(page);
  await misReservas.abrir();

  // Act
  await misReservas.verHistorial();

  // Assert
  await expect(misReservas.tarjetasConEstado('Finalizada')).toHaveCount(2);
});
```

Uno con un flujo entero (reservar, pagar y ver la reserva confirmada) está en `tests/reservar-y-pagar-sena.spec.js`.

Las reglas:

1. **`require('../soporte/fixtures')`**, nunca `@playwright/test` directo: sin eso, el front le habla al back equivocado.
2. **Patrón AAA** con los comentarios `// Arrange`, `// Act` y `// Assert`. Un flujo por test.
3. **Los selectores viven solo en `paginas/`.** Si un test necesita un `getBy…`, falta un método o una propiedad en el Page Object. Si la pantalla no tiene Page Object, se crea uno.
4. **Buscar por rol, etiqueta, texto o `data-testid`**, en ese orden de preferencia. Nunca por clases CSS ni por la posición en el HTML.
5. **Si falta un `data-testid`, se agrega al HTML o al JS de la pantalla** con un nombre que diga qué es (`detalle-precio-total`, `tarjeta-reserva`). En el JS, con `setAttribute('data-testid', …)`: los tests unitarios usan un DOM simulado sin `dataset`.
6. **Nunca `waitForTimeout`.** Los `expect` de Playwright ya esperan a que aparezca lo que buscan (hasta 10 segundos).
7. **Cada test arma lo que necesita y no depende de otro.** Corren de a uno y sobre la misma base, que se rearma en cada ejecución. Si un test cambia algo (por ejemplo, reserva unas fechas), que use datos que ningún otro test mire.
8. **Pago simulado siempre.** El pago real con MetaMask lo cubren los tests del contrato (Foundry) y los del verificador del back.
9. **Comentario de objetivo** arriba de cada archivo, de cada test y de cada método de un Page Object.

## Accesibilidad

`tests/accesibilidad.spec.js` pasa axe-core por las pantallas principales y falla si encuentra problemas graves (WCAG 2.1 A y AA, impacto "serious" o "critical"). Para sumar una pantalla, se agrega una entrada en `PANTALLAS`. Todos los hallazgos, también los menores, quedan adjuntos en el reporte como `axe.json`.

## Smoke de producción

`smoke/produccion.spec.js` es otro grupo de tests, que corre **contra la app desplegada** y no contra el back local. Su configuración propia es `playwright.smoke.config.js`. Son 4 tests de **solo lectura**: nunca reservan, pagan ni modifican nada en producción.

| Test | Qué pieza comprueba |
| --- | --- |
| `/api/estado` responde `ok` | La redirección `/api` de Vercel, el back en Railway y la base en Aiven |
| El inicio carga con los destinos | El front en Vercel y su primer pedido al back |
| La búsqueda responde y abre un detalle | `/buscar` y el detalle de un alojamiento real |
| El inicio de sesión responde | Un `POST` con un mail que no existe llega al back (CORS y cookies), y vuelve el error de credenciales, no el de "sin conexión" |

Cuándo corre:

- **Después de cada deploy del front:** `.github/workflows/smoke.yml`, cuando Vercel termina un deploy de producción.
- **Después de cada deploy del back:** el job "Smoke de producción" del CI del back baja este repo y corre los mismos tests.
- **Todos los días a las 8**, por si se cae Railway o Aiven aunque nadie haya desplegado.
- **A mano:** en Actions → Smoke de producción → Run workflow, o en tu máquina, dentro de `e2e/`:

```bash
npx playwright test -c playwright.smoke.config.js
SMOKE_URL=https://<una-preview>.vercel.app npx playwright test -c playwright.smoke.config.js   # otro despliegue
```

Un smoke nuevo tiene que ser de solo lectura y no puede depender de datos de prueba: en producción no está el seeder.
