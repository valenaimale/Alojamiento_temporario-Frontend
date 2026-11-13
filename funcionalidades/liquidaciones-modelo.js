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

  // Por qué se liquida, que es lo primero que el propietario necesita entender cuando ve un cobro:
  // no es lo mismo una estadía que una reserva que no se usó. El backend lo manda en "motivo".
  const MOTIVOS = {
    estadia: {
      texto: "Estadía",
      ayuda: "El huésped ingresó: lo que cobró la reserva ya es tuyo.",
    },
    cancelacion: {
      texto: "Cancelación",
      ayuda: "Es lo que retuvo la política de cancelación que aceptó el huésped.",
    },
    no_show: {
      texto: "No se presentó",
      ayuda:
        "Nadie registró el ingreso dentro de las 24 hs del horario de check-in: se retuvo todo lo que había pagado.",
    },
    extension: {
      texto: "Extensión",
      ayuda: "Son las noches extra que el huésped agregó a una estadía en curso.",
    },
  };

  // Cómo mostrar el motivo de una liquidación: { clave, texto, ayuda }.
  // En una extensión el texto nombra la reserva original, que es lo que le permite al propietario
  // relacionar ese cobro con la estadía a la que se le agregaron las noches.
  // Un motivo nuevo del backend se muestra tal cual en vez de romper la página.
  function motivo(liquidacion) {
    const clave = liquidacion.motivo;
    const base = MOTIVOS[clave] ?? { texto: clave, ayuda: "" };
    const original = liquidacion.reserva?.extiende_reserva_id ?? null;
    if (clave !== "extension" || original === null) {
      return { clave, ...base };
    }
    return { clave, ...base, texto: `Extensión de la reserva n.º ${original}` };
  }

  // Si la liquidación es de una extensión: sus noches son las noches extra, no las de la estadía original (#70)
  function esExtension(liquidacion) {
    return liquidacion.motivo === "extension";
  }

  // Cómo se nombra el período que liquida: las noches de la estadía, o las noches extra de una extensión
  function tituloDelPeriodo(liquidacion) {
    return esExtension(liquidacion) ? "Noches extra" : "Estadía";
  }

  // El aviso que corresponde mostrar cuando falta alguna billetera de cobro, o null si no falta ninguna.
  // El backend manda faltan_billeteras: ["propietario"], ["administrador"], las dos, o vacío.
  //
  // El texto cambia según quién esté mirando ("propietario" o "administrador"), porque las dos situaciones
  // se resuelven distinto: si falta LA SUYA, la puede cargar él y la pantalla lo lleva al perfil; si falta
  // la del otro, no puede hacer nada, y lo único que necesita es entender por qué no le pagaron todavía.
  // Devuelve { propia, texto }: 'propia' dice si hay algo que pueda hacer quien mira.
  function avisoDeBilletera(faltanBilleteras, quienMira) {
    const faltan = faltanBilleteras ?? [];
    if (faltan.length === 0) return null;

    if (faltan.includes(quienMira)) {
      return {
        propia: true,
        texto:
          "Para poder transferirte, necesitamos tu billetera de cobro. Cargala en tu perfil: " +
          "hasta entonces, lo que cobró esta estadía queda retenido en el contrato.",
      };
    }
    // Falta la del otro: las dos partes se transfieren en la misma operación, así que tampoco se le paga a él
    const elOtro = quienMira === "propietario" ? "El administrador" : "El propietario";
    return {
      propia: false,
      texto:
        `${elOtro} de la unidad todavía no cargó su billetera de cobro. Hasta que la cargue, esta ` +
        "liquidación no se paga, porque las dos partes se transfieren juntas.",
    };
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
    motivo,
    esExtension,
    tituloDelPeriodo,
    avisoDeBilletera,
    filasDelPropietario,
    filasDelAdministrador,
    totales,
    sumar,
  };
})();

// Para poder probar estas reglas con Node (en el navegador no existe module)
if (typeof module !== "undefined") module.exports = LiquidacionesModelo;
