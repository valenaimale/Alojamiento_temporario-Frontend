// Las reglas de las liquidaciones: qué filas tiene cada comprobante, en qué orden y con qué signo,
// y cuánto suma cada estado (RF-09, RF-13, RF-19, RN-24, RN-25).
// Los números son los del comprobante que armó el contador, con $425.000 cobrados.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const M = require("../funcionalidades/liquidaciones-modelo.js");

// El comprobante que devuelve el back para una propietaria que discrimina IVA, con administrador al 10 %
function comprobanteDelPropietario(cambios = {}) {
  return {
    para: "propietario",
    numero: 3,
    estado: "pendiente",
    propietario: { nombre: "Elsa Quiroga", cuit: "27234567891", cobra_iva: true },
    administrador: { nombre: "Cacho Fernández", cuit: "20301234563", cobra_iva: true, porcentaje: "10.00" },
    importe_cobrado: "425000.00",
    porcentaje_iva: "21.00",
    importe_iva: "73760.33",
    base_comisiones: "351239.67",
    porcentaje_comision_plataforma: "7.50",
    comision_plataforma: "26342.98",
    comision_administrador: "35123.97",
    importe_propietario: "363533.05",
    faltante: null,
    ...cambios,
  };
}

test("el comprobante del propietario sigue el orden que pidió el contador", () => {
  const filas = M.filasDelPropietario(comprobanteDelPropietario());

  assert.deepEqual(
    filas.map((f) => [f.clave, f.importe, f.signo]),
    [
      ["cobrado", "425000.00", ""],
      ["iva", "73760.33", ""],
      ["base", "351239.67", ""],
      ["plataforma", "26342.98", "-"],
      ["administrador", "35123.97", "-"],
      ["propietario", "363533.05", "="],
    ],
  );
  // la última fila es el número que cierra el comprobante
  assert.equal(filas.at(-1).destacada, true);
});

test("las comisiones se muestran como lo que restan y el total como total", () => {
  const filas = M.filasDelPropietario(comprobanteDelPropietario());
  const resta = filas.filter((f) => f.signo === "-").map((f) => f.clave);

  assert.deepEqual(resta, ["plataforma", "administrador"]);
  assert.equal(filas.filter((f) => f.signo === "=").length, 1);
});

test("sin IVA discriminado no hay fila de IVA y la base se explica (RN-24)", () => {
  const filas = M.filasDelPropietario(
    comprobanteDelPropietario({
      propietario: { nombre: "Marisa Gómez", cuit: null, dni: "30111222", cobra_iva: false },
      porcentaje_iva: "0.00",
      importe_iva: "0.00",
      base_comisiones: "425000.00",
      comision_plataforma: "31875.00",
      comision_administrador: "42500.00",
      importe_propietario: "350625.00",
    }),
  );

  assert.equal(
    filas.some((f) => f.clave === "iva"),
    false,
  );
  assert.equal(filas[1].concepto, "Base de comisiones (no discrimina IVA)");
  assert.equal(filas.at(-1).importe, "350625.00");
});

test("una unidad de autogestión no muestra comisión de administrador", () => {
  const filas = M.filasDelPropietario(
    comprobanteDelPropietario({ administrador: null, comision_administrador: "0.00" }),
  );

  assert.equal(
    filas.some((f) => f.clave === "administrador"),
    false,
  );
});

test("solo las filas con porcentaje lo llevan, para que el front lo muestre entre paréntesis", () => {
  const filas = M.filasDelPropietario(comprobanteDelPropietario());
  const conPorcentaje = filas.filter((f) => f.porcentaje !== null).map((f) => [f.clave, f.porcentaje]);

  assert.deepEqual(conPorcentaje, [
    ["iva", "21.00"],
    ["plataforma", "7.50"],
    ["administrador", "10.00"],
  ]);
});

test("el comprobante del administrador trae su comisión y nada más (RF-19)", () => {
  const filas = M.filasDelAdministrador({
    para: "administrador",
    administrador: { nombre: "Cacho Fernández", porcentaje: "10.00", cobra_iva: true },
    base_comisiones: "351239.67",
    comision: "35123.97",
  });

  assert.deepEqual(
    filas.map((f) => [f.clave, f.importe, f.signo]),
    [
      ["base", "351239.67", ""],
      ["comision", "35123.97", "="],
    ],
  );
});

test("los totales agrupan por estado y cuentan las estadías", () => {
  const totales = M.totales(
    [
      { estado: "pendiente", importe_propietario: "100000.50" },
      { estado: "pendiente", importe_propietario: "200000.50" },
      { estado: "pagada", importe_propietario: "50000.00" },
      { estado: "retenida_por_deuda", importe_propietario: "10000.00" },
    ],
    "importe_propietario",
  );

  assert.deepEqual(totales.pendiente, { cantidad: 2, total: "300001.00" });
  assert.deepEqual(totales.pagada, { cantidad: 1, total: "50000.00" });
  assert.deepEqual(totales.retenida_por_deuda, { cantidad: 1, total: "10000.00" });
});

test("sin liquidaciones los totales quedan en cero y no en vacío", () => {
  const totales = M.totales([], "importe_propietario");

  assert.deepEqual(totales.pendiente, { cantidad: 0, total: "0.00" });
});

test("los importes se suman sin errores de coma flotante", () => {
  assert.equal(M.sumar("0.10", "0.20"), "0.30");
  assert.equal(M.sumar("0.07", "0.07"), "0.14");
  assert.equal(M.sumar("999999.99", "0.01"), "1000000.00");
});

test("un estado que el front no conoce se muestra tal cual y no rompe el resumen", () => {
  assert.equal(M.estado("vuelta_atras").texto, "vuelta_atras");
  assert.deepEqual(M.totales([{ estado: "vuelta_atras", comision: "1.00" }], "comision").pendiente, {
    cantidad: 0,
    total: "0.00",
  });
});

test("cada estado explica por qué está así, que es lo que el propietario necesita entender", () => {
  assert.match(M.estado("retenida_por_deuda").ayuda, /no se cobró/i);
  assert.equal(M.estado("pendiente").texto, "Pendiente");
  assert.equal(M.estado("pagada").texto, "Pagada");
});

// ---------- El aviso de la billetera de cobro (#42 y #44 de las decisiones de pagos) ----------

test("con las billeteras cargadas no hay ningun aviso", () => {
  assert.equal(M.avisoDeBilletera([], "propietario"), null);
  assert.equal(M.avisoDeBilletera([], "administrador"), null);
});

test("si el backend no manda el campo, tampoco avisa nada", () => {
  assert.equal(M.avisoDeBilletera(undefined, "propietario"), null);
  assert.equal(M.avisoDeBilletera(null, "administrador"), null);
});

test("al que le falta SU billetera se le pide que la cargue", () => {
  const aviso = M.avisoDeBilletera(["propietario"], "propietario");

  assert.equal(aviso.propia, true);
  assert.match(aviso.texto, /tu billetera/i);
  assert.match(aviso.texto, /perfil/i);
});

test("al administrador que no cargo la suya tambien se le pide", () => {
  const aviso = M.avisoDeBilletera(["administrador"], "administrador");

  assert.equal(aviso.propia, true);
  assert.match(aviso.texto, /tu billetera/i);
});

test("si falta la del otro, se explica por que no se paga y no se le pide nada", () => {
  const alPropietario = M.avisoDeBilletera(["administrador"], "propietario");
  const alAdministrador = M.avisoDeBilletera(["propietario"], "administrador");

  assert.equal(alPropietario.propia, false);
  assert.match(alPropietario.texto, /El administrador/);
  assert.equal(alAdministrador.propia, false);
  assert.match(alAdministrador.texto, /El propietario/);
});

test("si faltan las dos, a cada uno se le pide la suya primero", () => {
  const alPropietario = M.avisoDeBilletera(["propietario", "administrador"], "propietario");
  const alAdministrador = M.avisoDeBilletera(["propietario", "administrador"], "administrador");

  assert.equal(alPropietario.propia, true);
  assert.equal(alAdministrador.propia, true);
});

// ---------- Por qué se liquida: no-show y extensión (decisiones #57, #67 y #70) ----------

test("una estadia normal se muestra como estadia y su periodo son las noches de la estadia", () => {
  const liquidacion = { motivo: "estadia", reserva: { id: 7, extiende_reserva_id: null } };

  assert.equal(M.motivo(liquidacion).clave, "estadia");
  assert.equal(M.motivo(liquidacion).texto, "Estadía");
  assert.equal(M.esExtension(liquidacion), false);
  assert.equal(M.tituloDelPeriodo(liquidacion), "Estadía");
});

test("un no-show se muestra como 'No se presento' y explica que se retuvo todo lo pagado", () => {
  const liquidacion = { motivo: "no_show", reserva: { id: 7, extiende_reserva_id: null } };
  const motivo = M.motivo(liquidacion);

  assert.equal(motivo.texto, "No se presentó");
  assert.match(motivo.ayuda, /24 hs/);
  assert.match(motivo.ayuda, /todo lo que había pagado/i);
  // no es una extensión: su período sigue siendo la estadía que no se usó
  assert.equal(M.esExtension(liquidacion), false);
  assert.equal(M.tituloDelPeriodo(liquidacion), "Estadía");
});

test("una cancelacion se distingue de un no-show: nadie cancelo nada en un no-show", () => {
  assert.equal(M.motivo({ motivo: "cancelacion" }).texto, "Cancelación");
  assert.match(M.motivo({ motivo: "cancelacion" }).ayuda, /política de cancelación/i);
  assert.notEqual(M.motivo({ motivo: "cancelacion" }).texto, M.motivo({ motivo: "no_show" }).texto);
});

test("una extension nombra la reserva que extiende y su periodo son las noches extra", () => {
  const liquidacion = { motivo: "extension", reserva: { id: 12, extiende_reserva_id: 7 } };

  assert.equal(M.motivo(liquidacion).texto, "Extensión de la reserva n.º 7");
  assert.match(M.motivo(liquidacion).ayuda, /noches extra/i);
  assert.equal(M.esExtension(liquidacion), true);
  assert.equal(M.tituloDelPeriodo(liquidacion), "Noches extra");
});

test("una extension sin la reserva original igual se entiende", () => {
  assert.equal(M.motivo({ motivo: "extension" }).texto, "Extensión");
  assert.equal(M.motivo({ motivo: "extension", reserva: { id: 12, extiende_reserva_id: null } }).texto, "Extensión");
});

test("un motivo que el front no conoce se muestra tal cual y no rompe la pagina", () => {
  const motivo = M.motivo({ motivo: "reintegro_judicial", reserva: { id: 1, extiende_reserva_id: null } });

  assert.equal(motivo.texto, "reintegro_judicial");
  assert.equal(motivo.ayuda, "");
  assert.equal(M.tituloDelPeriodo({ motivo: "reintegro_judicial" }), "Estadía");
});
