// Las reglas de las liquidaciones, sin tocar el DOM ni el backend: qué filas tiene cada comprobante,
// en qué orden y con qué signo, cómo se le muestra cada estado y cuánto suma cada uno.
// Está separado de la página para poder probarlo con Node (tests/liquidaciones-modelo.test.cjs).
//
// El modelo no formatea nada: devuelve los importes y los porcentajes como vienen del backend
// ("351239.67", "7.50") y la página los pasa por formatearPrecio y formatearPorcentaje.
const LiquidacionesModelo = (() => {
  // Cómo se le muestra cada estado al usuario. La ayuda explica el por qué, que es lo que
  // el propietario necesita entender cuando una liquidación no se le pagó.
  const ESTADOS = {
    pendiente: {
      texto: "Pendiente",
      clase: "estado-pendiente",
      ayuda: "Calculada y lista para transferirte.",
    },
    retenida_por_deuda: {
      texto: "Retenida por deuda",
      clase: "estado-retenida",
      ayuda: "No se liquida lo que todavía no se cobró.",
    },
    pagada: {
      texto: "Pagada",
      clase: "estado-pagada",
      ayuda: "Ya se te transfirió.",
    },
  };

  // Cómo mostrar un estado. Si el backend agrega uno nuevo, se muestra tal cual en vez de romper la página.
  function estado(nombre) {
    return (
      ESTADOS[nombre] ?? { texto: nombre, clase: "estado-pendiente", ayuda: "" }
    );
  }

  // Las filas del comprobante del propietario, en el orden que pidió el contador (RN-25).
  // Cada fila: { clave, concepto, porcentaje (o null), importe, signo, destacada }.
  // El signo es para mostrar: '' suma o informa, '-' resta, '=' es el total.
  // Si el propietario no discrimina IVA no hay fila de IVA: no hay nada que discriminar (RN-24).
  function filasDelPropietario(comprobante) {
    const filas = [
      fila("cobrado", "Importe cobrado al huésped", null, comprobante.importe_cobrado),
    ];
    if (comprobante.propietario.cobra_iva) {
      filas.push(
        fila("iva", "IVA incluido", comprobante.porcentaje_iva, comprobante.importe_iva),
        fila("base", "Base de comisiones (neto sin IVA)", null, comprobante.base_comisiones),
      );
    } else {
      filas.push(
        fila("base", "Base de comisiones (no discrimina IVA)", null, comprobante.base_comisiones),
      );
    }
    filas.push(
      fila(
        "plataforma",
        "Comisión de la plataforma",
        comprobante.porcentaje_comision_plataforma,
        comprobante.comision_plataforma,
        "-",
      ),
    );
    if (comprobante.administrador !== null) {
      filas.push(
        fila(
          "administrador",
          "Comisión del administrador",
          comprobante.administrador.porcentaje,
          comprobante.comision_administrador,
          "-",
        ),
      );
    }
    filas.push(
      fila("propietario", "Importe para el propietario", null, comprobante.importe_propietario, "=", true),
    );
    return filas;
  }

  // Las filas del comprobante del administrador (RF-19): su comisión y nada más, porque la factura aparte
  function filasDelAdministrador(comprobante) {
    return [
      fila("base", "Base de comisiones", null, comprobante.base_comisiones),
      fila(
        "comision",
        "Tu comisión",
        comprobante.administrador.porcentaje,
        comprobante.comision,
        "=",
        true,
      ),
    ];
  }

  // Una fila del comprobante
  function fila(clave, concepto, porcentaje, importe, signo = "", destacada = false) {
    return { clave, concepto, porcentaje, importe, signo, destacada };
  }

  // Cuánto suma cada estado y cuántas liquidaciones hay en cada uno, para el resumen de arriba.
  // $importe dice qué columna sumar: el importe del propietario o la comisión del administrador.
  // Devuelve { pendiente: {cantidad, total}, retenida_por_deuda: {...}, pagada: {...} }.
  function totales(liquidaciones, importe) {
    const resumen = {
      pendiente: { cantidad: 0, total: "0.00" },
      retenida_por_deuda: { cantidad: 0, total: "0.00" },
      pagada: { cantidad: 0, total: "0.00" },
    };
    for (const liquidacion of liquidaciones) {
      const grupo = resumen[liquidacion.estado];
      if (grupo === undefined) continue; // un estado nuevo del backend no rompe el resumen
      grupo.cantidad++;
      grupo.total = sumar(grupo.total, liquidacion[importe]);
    }
    return resumen;
  }

  // Suma dos importes del backend sin coma flotante: "0.10" + "0.20" da "0.30" y no "0.30000000000000004"
  function sumar(a, b) {
    return aPesos(aCentavos(a) + aCentavos(b));
  }

  // "351239.67" → 35123967 centavos
  function aCentavos(monto) {
    const [entera, decimal = "0"] = String(monto).split(".");
    return Number(entera) * 100 + Number(decimal.padEnd(2, "0").slice(0, 2));
  }

  // 35123967 centavos → "351239.67"
  function aPesos(centavos) {
    return `${Math.trunc(centavos / 100)}.${String(centavos % 100).padStart(2, "0")}`;
  }

  return {
    estado,
    filasDelPropietario,
    filasDelAdministrador,
    totales,
    sumar,
  };
})();

// Para poder probar estas reglas con Node (en el navegador no existe module)
if (typeof module !== "undefined") module.exports = LiquidacionesModelo;
