# Front de pagos

Implementación del Rol 3 del plan del 05/11/2026. Incluye seña y saldo, conexión a MetaMask, seguimiento de transacciones y recuperación de confirmaciones interrumpidas. El código es HTML, CSS y JavaScript nativos. `billetera.js` importa viem **2.38.5** dinámicamente desde `https://esm.sh/viem@2.38.5?bundle`; una falla de carga permite reintentar.

## Estado de integración

El frontend está implementado y probado localmente. Falta integrar los endpoints del Rol 2 y la dirección/ABI del Rol 1, y completar una prueba real de punta a punta en Base Sepolia. Las capturas y recorridos de navegador utilizan respuestas de prueba: no acreditan un pago real en blockchain. Confirmar con los docentes la aceptación de viem sin wagmi.

La única red habilitada es **Base Sepolia, chain ID 84532**, con ETH de prueba. El frontend no contiene claves privadas ni dirección de contrato ficticia. La dirección y los importes vienen del backend. No se modificaron archivos del backend ni se publicaron estos cambios.

## Contrato de API propuesto para el Rol 2

El plan define las rutas y su propósito, pero no el JSON exacto. Este documento fija el formato esperado por la implementación para coordinar la integración; no afirma que el backend ya lo exponga.

### Cotizar la seña o el saldo

`GET /pagos/sena?reserva_id=42` y `GET /pagos/saldo?reserva_id=42`, con la sesión habitual (`credentials: include`). Respuesta 200:

```json
{
  "pago": {
    "reserva_id": 42,
    "tipo": "sena",
    "monto_pesos": "70000.00",
    "monto_wei": "700000000000000",
    "pesos_por_eth": "100000000.00",
    "red": 84532,
    "contrato_direccion": "DIRECCION_REAL_DEL_CONTRATO_DESPLEGADO",
    "bloqueo_expira_en": "2027-02-01T18:00:00-03:00"
  }
}
```

- El ejemplo de dirección es un marcador documental y se rechaza si se envía literalmente.
- Los tres campos de importes son **strings decimales**, nunca floats JSON. `monto_wei` es entero positivo. La conversión se verifica con BigInt: `ceil(monto_pesos × 10^18 / pesos_por_eth)`. Con la tasa acordada de 100.000.000 y centavos, la división es exacta.
- `reserva_id` puede ser número entero seguro o string entero; debe coincidir con la URL. `tipo` solo admite `sena` o `saldo`; `red` es el número 84532.
- `bloqueo_expira_en` puede omitirse o ser null. Cuando existe, exige ISO 8601 con zona, nunca una fecha/hora SQL ambigua.
- El backend debe comprobar titular, estado, vencimiento y pago previo **cada vez que cotiza**. Debe rechazar una reserva cancelada, vencida, ajena o ya pagada; no devolver una cotización cobrable.
- Errores usan `{ "error": "Explicación para el huésped" }`. 401 ofrece iniciar sesión conservando reserva/tipo; 404/503 indican pago no disponible y bloquean el botón. No hay cotización de reemplazo calculada por el navegador.

### Registrar una transacción

`POST /pagos/confirmar`, JSON:

```json
{ "reserva_id": "42", "tx_hash": "0xHASH_DE_64_DIGITOS_HEXADECIMALES" }
```

La interfaz informa éxito exclusivamente después de un receipt `success` y una respuesta exitosa del backend con:

```json
{ "pago": { "estado": "confirmado" } }
```

Un 202 con `estado: pendiente`, o un 200 sin esa confirmación explícita, conserva el hash y ofrece retomar. El endpoint debe ser **idempotente** para la misma reserva/transacción: consultar un pago ya registrado debe devolver su confirmación sin duplicarlo. El servidor valida red, contrato, evento, tipo, importe y pertenencia de reserva. El frontend no acredita pagos por su cuenta.

### Resumen de reservas

Se reutiliza `GET /reservas/mias` y su objeto `reservas[]` actual. Campos adicionales previstos:

```json
{
  "monto_faltante": "280000.00",
  "fecha_cobro": "2027-02-05",
  "bloqueo_expira_en": "2027-02-01T18:00:00-03:00",
  "pagos": [
    { "tipo": "sena", "estado": "confirmado", "tx_hash": "0xHASH_VALIDO" }
  ]
}
```

`pendiente` y `pendiente_pago` habilitan seña si el plazo no venció. Una reserva `confirmada` ofrece saldo solo con `monto_faltante > 0`; no se inventa saldo ni pago completo ante información ausente. Un saldo confirmado o monto faltante cero muestra pago completo. Estados terminales no habilitan cobros. Un pago pendiente con hash ofrece revisar el envío. Los plazos se muestran en hora argentina; una fecha sin hora conserva su día.

`POST /reservas/crear` ya responde `{ok, reserva: {id, ...}}`. El detalle usa ese ID para abrir `pagar.html?reserva_id=...&tipo=sena`; ante una respuesta vieja sin ID utilizable conserva la salida a Mis reservas.

## Transacción y recuperación

1. Consultar sesión y verificar que la reserva pertenece al listado del huésped.
2. Mostrar resumen, importe en pesos, ETH exacto, tasa y plazo.
3. Al pagar, pedir nuevamente la cotización. Si cambian importe o destino, actualizar pantalla y exigir otro clic antes de firmar.
4. Conectar MetaMask, cambiar/agregar Base Sepolia, verificar cuenta/red y bytecode, consultar saldo y simular el contrato. ABI mínimo: `pagarSena(uint256)` o `pagarSaldo(uint256)`, payable.
5. Enviar y guardar el hash por usuario/reserva/tipo en localStorage. No se guardan claves ni datos personales del huésped.
6. Esperar receipt; conservar hash si hay timeout, RPC caído o error del backend. Una aceleración actualiza el hash. Solo cancelación o reversión confirmadas permiten limpiar un intento fallido.
7. Registrar en el backend. Limpiar pendiente únicamente al confirmar el registro.

Los dobles clics quedan bloqueados; Web Locks coordina pestañas cuando el navegador lo soporta. El servidor y el contrato deben imponer también la unicidad de pago por reserva/tipo: ningún bloqueo de navegador sustituye esa validación entre dispositivos.

Si MetaMask pudo haber enviado pero no devolvió un hash válido, se guarda un estado de **envío incierto** y se bloquea otro pago. El huésped puede copiar el identificador desde Actividad de MetaMask y consultar esa transacción, sin firmar otra. El servidor sigue validando su pertenencia. Si no existe transacción, hace falta reconciliar el estado con el backend; no se asume que la transferencia falló.

## Archivos y verificación

- `funcionalidades/billetera.js`: proveedor y operaciones viem.
- `funcionalidades/pagos-modelo.js`: montos, cotización, estados y errores; compatible con navegador y Node.
- `funcionalidades/pagar.js`, `vistas/reservas/pagar.html`, `estilos/pagar.css`: pantalla y recuperación.
- `mis-reservas.js/html/css` y enlace en `detalle-alojamiento.js`: acceso desde reservas.
- Tests nuevos: `billetera.test.cjs`, `pagos-modelo.test.cjs`, `pagar.test.cjs`, `mis-reservas-pagos.test.cjs`; actualización de `detalle-cotizacion.test.cjs`.

```sh
node --test tests/*.test.cjs
```

Pruebas de navegador con datos locales: escritorio 1440 px, ancho intermedio y móvil 390 px; seña, saldo, plazos, recuperación tras timeout con un solo envío, confirmación final y API ausente. La biblioteca del CDN se cargó de verdad; firma, red y backend de los recorridos de pago se simularon. No se ejecutaron transferencias ni acciones de producción.

Referencias primarias: [instalación de viem y CDN](https://viem.sh/docs/installation), [simulación](https://viem.sh/docs/contract/simulateContract), [escritura de contrato](https://viem.sh/docs/contract/writeContract), [espera y reemplazos](https://viem.sh/docs/actions/public/waitForTransactionReceipt).
