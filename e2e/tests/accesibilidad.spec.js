// Accesibilidad con axe-core: las pantallas principales no tienen problemas graves (WCAG 2.1 A y AA).
// Falla con los hallazgos "critical" y "serious"; todos los hallazgos quedan adjuntos en el reporte (axe.json).
const { test, expect } = require('../soporte/fixtures');
const AxeBuilder = require('@axe-core/playwright').default;
const { PaginaInicio } = require('../paginas/PaginaInicio');
const { PaginaInicioSesion } = require('../paginas/PaginaInicioSesion');
const { PaginaListado } = require('../paginas/PaginaListado');
const { PaginaMisReservas } = require('../paginas/PaginaMisReservas');
const { PaginaAgenda } = require('../paginas/PaginaAgenda');
const { PaginaLiquidacionesBackoffice } = require('../paginas/PaginaLiquidacionesBackoffice');
const { diasDesdeHoy } = require('../soporte/datos');

const BUSQUEDA = { ingreso: diasDesdeHoy(10), egreso: diasDesdeHoy(13), personas: 2 };

// Cada pantalla: con qué usuario entrar (o null) y cómo abrirla y esperar a que termine de cargar
const PANTALLAS = {
  'inicio': [null, async (page) => {
    const pagina = new PaginaInicio(page);
    await pagina.abrir();
    await pagina.titulo.waitFor();
  }],
  'inicio de sesión': [null, async (page) => {
    const pagina = new PaginaInicioSesion(page);
    await pagina.abrir();
    await pagina.botonIngresar.waitFor();
  }],
  'resultados de búsqueda': [null, async (page) => {
    const pagina = new PaginaListado(page);
    await pagina.abrir(BUSQUEDA);
    await pagina.tarjetas.first().waitFor();
  }],
  'mis reservas': ['huesped', async (page) => {
    const pagina = new PaginaMisReservas(page);
    await pagina.abrir();
    await pagina.tarjetas.first().waitFor();
  }],
  'agenda del operador': ['operadora', async (page) => {
    const pagina = new PaginaAgenda(page);
    await pagina.abrir();
    await pagina.movimientos.first().waitFor();
  }],
  'liquidaciones del backoffice': ['backoffice', async (page) => {
    const pagina = new PaginaLiquidacionesBackoffice(page);
    await pagina.abrir();
  }],
};

// Resume cada hallazgo en una línea, para que el mensaje del test diga qué arreglar y dónde
function resumir(hallazgos) {
  return hallazgos.map((h) => `${h.impact}: ${h.id} (${h.help}) en ${h.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

for (const [nombre, [usuario, abrir]] of Object.entries(PANTALLAS)) {
  // Un test por pantalla
  test(`${nombre} no tiene problemas graves de accesibilidad`, async ({ page }, testInfo) => {
    // Arrange
    if (usuario) await new PaginaInicioSesion(page).ingresarComo(usuario);
    await abrir(page);

    // Act
    const resultado = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    await testInfo.attach('axe.json', { body: JSON.stringify(resultado.violations, null, 2), contentType: 'application/json' });

    // Assert
    const graves = resultado.violations.filter((h) => ['critical', 'serious'].includes(h.impact));
    expect(resumir(graves)).toEqual([]);
  });
}
