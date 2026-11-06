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
