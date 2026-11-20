// Los datos que carga db/seeds/DatosDeEjemplo.php del back en la base alojamiento_e2e, para usarlos en los tests.
// Si cambia el seeder, se actualiza acá.

// Todos los usuarios de ejemplo tienen el mail verificado y esta contraseña
const CONTRASENIA = 'clave-segura-1';

// Un usuario por rol (y dos huéspedes y dos propietarias)
const USUARIOS = {
  huesped: { nombre: 'Juan Pérez', mail: 'juan@ejemplo.local' },
  otraHuesped: { nombre: 'Lucía Sosa', mail: 'lucia@ejemplo.local' },
  propietaria: { nombre: 'Marisa Gómez', mail: 'marisa@ejemplo.local' },
  propietariaConIva: { nombre: 'Elsa Quiroga', mail: 'elsa@ejemplo.local' },
  administrador: { nombre: 'Cacho Fernández', mail: 'cacho@ejemplo.local' },
  operadora: { nombre: 'Nadia Ruiz', mail: 'nadia@ejemplo.local' },
  backoffice: { nombre: 'Rocío Paz', mail: 'rocio@ejemplo.local' },
};

// Las unidades. Fechas ocupadas, en días desde hoy (el egreso no es una noche):
//  - Cabaña del Mar: bloqueada del 20 al 26 y reservada (pendiente) del 40 al 45. Temporada baja hasta el día 59
//    (mínimo 2 noches, $60.000 la noche) y alta desde el 60 (mínimo 7 noches, $90.000).
//  - Casa del Bosque: reservada por Lucía (confirmada, con el saldo pendiente) del 3 al 8. Mínimo 3 noches, $80.000.
//  - Loft del Centro: mínimo 2 noches, $85.000.
//  - Departamento Costanera: en borrador, nunca aparece en la búsqueda.
//  - Cabaña de los Pinos: de Elsa, en Mar de las Pampas, mínimo 4 noches (no aparece en las búsquedas de 3 noches).
const UNIDADES = {
  cabania: { nombre: 'Cabaña del Mar', localidad: 'Las Grutas', precioNoche: 60000 },
  casa: { nombre: 'Casa del Bosque', localidad: 'Mar de las Pampas', precioNoche: 80000 },
  loft: { nombre: 'Loft del Centro', localidad: 'Villa Gesell', precioNoche: 85000 },
  borrador: { nombre: 'Departamento Costanera', localidad: 'Las Grutas' },
  pinos: { nombre: 'Cabaña de los Pinos', localidad: 'Mar de las Pampas', precioNoche: 70000 },
};

// La unidad grupal de Cacho (US4.4): la Casa del Bosque (6 personas) y la Cabaña de los Pinos (4, mínimo 4 noches).
// Aparece en las búsquedas de 7 a 10 personas, de 4 noches o más: ninguna de las dos alcanza sola.
const GRUPAL = { titulo: 'Complejo del Bosque', unidades: ['Casa del Bosque', 'Cabaña de los Pinos'], capacidad: 10 };

// La fecha de dentro de N días ("AAAA-MM-DD"), en la hora de Argentina, como la calculan el front y el seeder
function diasDesdeHoy(dias) {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
  const fecha = new Date(`${hoy}T12:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

module.exports = { CONTRASENIA, USUARIOS, UNIDADES, GRUPAL, diasDesdeHoy };
