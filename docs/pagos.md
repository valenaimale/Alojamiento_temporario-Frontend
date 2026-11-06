# Front de pagos

Implementación del Rol 3, adaptada el 05/11/2026 a la guía del Rol 2 y al backend publicado en `origin/main` (`cd04ae7`). HTML, CSS y JavaScript nativos. Para pagos reales se importa viem **2.38.5** desde `https://esm.sh/viem@2.38.5?bundle`.

## Estado de integración

- El backend publicado incorpora seña y verificación simulada. La simulación usa red **31337**; no conecta MetaMask, no cambia de red y no mueve fondos.
- El frontend incorpora saldo según la guía del Rol 2. En la revisión del backend citado todavía faltan `GET /pagos/saldo` y los campos `saldo`, `fecha_cobro`, `puede_pagar_saldo` en `/reservas/mias`. La prueba de saldo usa respuestas locales de prueba.
- El pago real requiere `pago.simulado: false`, contrato desplegado y red **84532 (Base Sepolia)**. Falta validar una operación completa con el verificador real y los roles 1 y 2.
- La cancelación de reservas confirmadas con devolución todavía no está disponible. La interfaz no promete ejecutar una devolución.
- Los cambios se publican en `feature/rol3-front-pagos`, sin integrar a `main`.

## Contrato de API

### Cotizar seña o saldo

`GET /pagos/sena?reserva_id=42` o `GET /pagos/saldo?reserva_id=42`, con `credentials: include`:

```json
{
  "reserva_id": 42,
  "tipo": "sena",
  "monto_pesos": "70000.00",
  "monto_wei": "700000000000000",
  "pesos_por_eth": "100000000",
  "red": 31337,
  "vence_en": "2027-02-01T21:00:00Z",
  "pago": {
    "contrato": null,
    "funcion": "pagarSena",
    "simulado": true
  }
}
```

Los importes y la red están en el nivel superior. `pago` contiene los datos de ejecución. Para saldo, `tipo` es `saldo` y la función es `pagarSaldo`.

- Los importes son strings decimales. `monto_wei` se convierte a **BigInt**, nunca a `Number`. La conversión coincide con `TipoDeCambio::aWei`: división entera con truncamiento de fracciones de wei. ETH se presenta sin punto flotante.
- La reserva y el tipo deben coincidir con la URL. La función debe corresponder al tipo. Una cotización real exige dirección no nula y red 84532; una simulada exige `simulado: true` y red 31337.
- `vence_en`, cuando existe, debe incluir zona horaria. Se presenta en hora argentina.
- Una cotización ausente, inválida, ajena o vencida bloquea el cobro. El navegador no inventa importes para reemplazar una respuesta inválida.
- Al hacer clic se consulta nuevamente. Si cambia importe, modalidad o destino, se exige revisar los datos antes de continuar.

### Confirmar una transacción

`POST /pagos/confirmar`, siempre con `tipo`:

```json
{ "reserva_id": "42", "tipo": "sena", "tx_hash": "0xHASH_DE_64_DIGITOS_HEXADECIMALES" }
```

| Código | Acción del frontend |
| --- | --- |
| 200 | Mostrar éxito y limpiar el intento guardado. No exige `pago.estado`: el backend actual no devuelve ese campo. |
| 202 | Conservar el hash y repetir la confirmación cada 3,5 segundos. Botón deshabilitado; no genera otro pago. |
| 402 | Mostrar el error, descartar el intento rechazado y ofrecer **Pagar de nuevo**. La próxima acción vuelve a cotizar. |
| 409 | Mostrar el error y bloquear el cobro. Conservar el hash para revisar el estado. |
| Error de conexión | Conservar el hash y ofrecer **Retomar confirmación**. |
| 401 | Conservar el hash y ofrecer iniciar sesión con regreso a la reserva. |

El backend es la autoridad de confirmación. El frontend no espera un receipt para decidir qué significa el HTTP 200. En el backend publicado, repetir un hash ya registrado puede devolver 409; no se presenta como un nuevo éxito ni se habilita otro envío.

### Resumen de reservas

Se reutiliza `GET /reservas/mias`, con `reservas[]`:

```json
{
  "id": 42,
  "estado": "pendiente",
  "vence_en": "2027-02-01T21:00:00Z",
  "puede_pagar": true,
  "saldo": "280000.00",
  "fecha_cobro": "2027-02-05",
  "puede_pagar_saldo": false
}
```

- Pendiente y `puede_pagar: true`: **Pagar la seña**, mientras no haya vencido `vence_en`.
- Confirmada, `saldo > 0` y `puede_pagar_saldo: true`: **Pagar el saldo**, mientras no haya vencido `fecha_cobro`.
- Fecha de cobro pasada: **Saldo vencido**, sin botón. Una fecha sin hora se considera vigente hasta terminar ese día en Argentina.
- Saldo cero: pago completo. Campos ausentes no habilitan cobros ni permiten afirmar que todo está pagado.
- Cancelada, expirada y otros estados terminales: sin cobros habilitados.

Tras `POST /reservas/crear`, una reserva pendiente abre `pagar.html?reserva_id={id}&tipo=sena`. Si vuelve `confirmada` por seña del 0 %, abre `mis-reservas.html?confirmada=1` e informa que no requiere seña; el saldo se consulta desde la reserva.

## Modalidades y recuperación

**Simulada:** el botón dice **Pagar (simulado)**. Genera un hash mediante `crypto.getRandomValues`, sin cargar viem ni acceder a MetaMask. Evita los sufijos reservados por el verificador de prueba (`dead`: rechazo; `0000`: pendiente permanente). El identificador no enlaza a BaseScan porque no existe una transacción blockchain.

**Real:** conecta MetaMask, verifica Base Sepolia, cuenta, contrato y saldo; simula y ejecuta `writeContract` sobre `pago.contrato`, con `pago.funcion` y `value: BigInt(monto_wei)`. ABI mínimo: `pagarSena(uint256)` o `pagarSaldo(uint256)`, payable. No contiene claves privadas ni contratos ficticios de reemplazo.

El hash se guarda en **sessionStorage**, separado por usuario, reserva y tipo. Una recarga permite retomar la confirmación con el mismo hash; no solicita otra firma. Este almacenamiento corresponde a la pestaña y no constituye un registro permanente o compartido entre dispositivos.

Dobles clics quedan bloqueados. Web Locks impide ejecuciones simultáneas mientras está tomado el bloqueo, pero no reemplaza la validación de unicidad en backend y contrato. Un resultado incierto de MetaMask conserva el intento y ofrece recuperar el hash manualmente, sin firmar otra vez. Un 202 mantiene el botón deshabilitado y cancela el temporizador al salir.

## Archivos y verificación

- `pagos-modelo.js`: conversiones exactas, validación de cotización, acciones y vencimientos.
- `billetera.js`: integración viem para pagos reales.
- `pagar.js`, `pagar.html`, `pagar.css`: presentación, simulación, confirmación y recuperación.
- `detalle-alojamiento.js`, `mis-reservas.js`: navegación, permisos, saldo y plazos.

```sh
node --test tests/*.test.cjs
```

Tests de Node: pesos ↔ wei, permisos, fechas, reserva con seña cero, simulación sin wallet, ejecución real mediante dobles de viem, códigos 200/202/402/409, reintentos, recarga, almacenamiento y prevención de envíos repetidos.

Recorridos de navegador con respuestas locales: pago simulado sin extensión, 202 repetido con el mismo hash, 402 con hash nuevo, 409 bloqueado, recuperación tras recarga, saldo y fecha vencida, escritorio y móvil de 390 px. No acreditan una transferencia real ni que el endpoint de saldo esté publicado.
