const { test } = require("node:test");
const assert = require("node:assert/strict");
const M = require("../funcionalidades/calendario-modelo.js");

test("configuración incluye la primera y la última noche", () => {
  assert.equal(M.noches("2026-12-05", "2026-12-10"), 6);
  assert.equal(M.noches("2026-12-05", "2026-12-05"), 1);
  assert.equal(M.noches("2026-12-31", "2027-01-02"), 3);
});
test("valida fechas reales, orden y límite de 366 noches", () => {
  assert.equal(M.fechaValida("2027-02-29"), false);
  assert.equal(M.fechaValida("2028-02-29"), true);
  assert.equal(M.rangoValido("2026-11-10", "2026-11-09"), false);
  assert.equal(M.rangoValido("2026-01-01", "2027-01-01"), true);
  assert.equal(M.rangoValido("2026-01-01", "2027-01-02"), false);
  assert.equal(M.rangoValido("", ""), false);
});
test("la noche de egreso puede usarse; un bloqueo incluye su último día", () => {
  const reservas = [{ ingreso: "2026-11-10", egreso: "2026-11-14" }];
  const bloqueos = [{ fecha_desde: "2026-11-05", fecha_hasta: "2026-11-07" }];
  const estado = (fecha) =>
    M.estadoNoche(
      { fecha, precio: "65000.00" },
      reservas,
      bloqueos,
      "2026-10-31",
    );
  assert.equal(estado("2026-11-10"), "reservada");
  assert.equal(estado("2026-11-13"), "reservada");
  assert.equal(estado("2026-11-14"), "libre");
  assert.equal(estado("2026-11-07"), "bloqueada");
  assert.equal(estado("2026-11-08"), "libre");
});
test("sin precio no equivale a libre; no se infiere ocupación histórica", () => {
  assert.equal(
    M.estadoNoche({ fecha: "2026-11-01", precio: null }, [], [], "2026-10-31"),
    "sin-precio",
  );
  assert.equal(
    M.estadoNoche({ fecha: "2026-10-30", precio: "100" }, [], [], "2026-10-31"),
    "pasada",
  );
  assert.equal(
    M.estadoNoche(
      { fecha: "2026-11-01", precio: null },
      [],
      [{ fecha_desde: "2026-11-01", fecha_hasta: "2026-11-02" }],
      "2026-10-31",
    ),
    "bloqueada",
  );
});
test("detecta cruces entre meses y no ocupa el egreso de una reserva", () => {
  assert.equal(
    M.superpone("2026-12-30", "2027-01-02", "2027-01-01", "2027-01-05"),
    true,
  );
  assert.equal(
    M.superpone(
      "2026-11-14",
      "2026-11-16",
      "2026-11-10",
      M.sumar("2026-11-14", -1),
    ),
    false,
  );
  assert.equal(M.sumar("2028-02-28", 1), "2028-02-29");
});
