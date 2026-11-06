# Front de pagos

Implementación del Rol 3, adaptada el 06/11/2026 a la guía de Fede (`docs/pagos-front.md`) y al backend integrado en `origin/main` (`63bb2d3`; pagos incorporados antes en `8781fd7`). HTML, CSS y JavaScript nativos. Para pagos reales se importa viem **2.38.5** desde `https://esm.sh/viem@2.38.5?bundle`.

## Estado de integración

- El backend integrado incorpora seña, saldo, vista previa de cancelación y devolución simulada. La simulación usa red **31337**; no conecta MetaMask, no cambia de red y no mueve fondos.
- El frontend utiliza `GET /pagos/saldo` y los campos `saldo`, `fecha_cobro`, `puede_pagar_saldo` de `/reservas/mias`. Una fecha de cobro vencida advierte al huésped, pero permite pagar cuando el servidor lo autoriza. No decide cancelar la reserva ni registrar una deuda.
- El pago real requiere `pago.simulado: false`, contrato desplegado y red **84532 (Base Sepolia)**. Falta validar una operación completa con el verificador real y los roles 1 y 2.
- La cancelación consulta primero `GET /reservas/cancelacion`: muestra seña y saldo pagados, retención sobre la seña y devolución total. Solo envía `POST /reservas/cancelar` después de confirmar. Respeta el resultado confirmado, pendiente o sin devolución del servidor.
- Los cambios se publican en `feature/rol3-front-pagos`, sin modificar `main` desde este trabajo. El equipo ya integró la etapa anterior mediante PR #15 y las liquidaciones mediante PR #16. Nuestra rama incorpora ambos merges.

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

Los importes y la red están en el nivel superior. `pago` contiene los datos de ejecución. Para saldo, `tipo` es `saldo`, la función es `pagarSaldo` y llegan `fecha_cobro` (AAAA-MM-DD) y `vencido` en lugar de `vence_en`. La pantalla prioriza el plazo informado por la cotización.

- Los importes son strings decimales. `monto_wei` se convierte a **BigInt**, nunca a `Number`. La conversión coincide con `TipoDeCambio::aWei`: división entera con truncamiento de fracciones de wei. ETH se presenta sin punto flotante.
- La reserva y el tipo deben coincidir con la URL. La función debe corresponder al tipo. Una cotización real exige dirección no nula y red 84532; una simulada exige `simulado: true` y red 31337.
- `vence_en`, cuando existe, debe incluir zona horaria. Se presenta en hora argentina.
- Una cotización ausente, inválida o ajena bloquea el cobro. El vencimiento de la seña bloquea; el del saldo advierte sin bloquear cuando el servidor permite pagarlo. El navegador no inventa importes para reemplazar una respuesta inválida.
- Al hacer clic se consulta nuevamente. Si cambia importe, modalidad o destino, se exige revisar los datos antes de continuar.

### Confirmar una transacción

`POST /pagos/confirmar`, siempre con `tipo`:

```json
{ "reserva_id": "42", "tipo": "sena", "tx_hash": "0xHASH_DE_64_DIGITOS_HEXADECIMALES" }
```

| Código | Acción del frontend |
| --- | --- |
| 200 | Mostrar `ok` tal cual y limpiar el intento guardado. No exige `pago.estado`: el backend actual no devuelve ese campo. |
| 202 | Mostrar `mensaje` tal cual. Conservar el hash y repetir cada 3,5 segundos hasta 2 minutos. Luego ofrecer **Volver a verificar**, con el mismo hash y sin otro pago. |
| 402 | Mostrar el error, descartar el intento rechazado y ofrecer **Pagar de nuevo**. La próxima acción vuelve a cotizar. |
| 409 | Mostrar el error y bloquear el cobro. Conservar el hash. Si la seña venció y conocemos el alojamiento, ofrecer volver a reservar. |
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
- Confirmada, `saldo > 0` y `puede_pagar_saldo: true`: **Pagar el saldo**, incluso si venció `fecha_cobro`.
- Fecha de cobro pasada: **Saldo vencido: pagalo antes de ingresar**, con botón si `puede_pagar_saldo: true`; sin botón si es falso. Una fecha sin hora se considera vigente hasta terminar ese día en Argentina.
- Saldo cero: pago completo. Campos ausentes no habilitan cobros ni permiten afirmar que todo está pagado.
- Cancelada, expirada y otros estados terminales: sin cobros habilitados.

Tras `POST /reservas/crear`, una reserva pendiente abre `pagar.html?reserva_id={id}&tipo=sena`. Si vuelve `confirmada` por seña del 0 %, abre `mis-reservas.html?confirmada=1` e informa que no requiere seña; el saldo se consulta desde la reserva.

### Cancelación y devolución

`GET /reservas/cancelacion?reserva_id={id}` devuelve `estado`, `tramo`, `dias_hasta_cobro`, `porcentaje_retencion`, `pagado.sena`, `pagado.saldo`, `retencion`, `devolucion` y `devolucion_wei`. Los importes son strings; wei se valida y convierte con BigInt. El frontend presenta los cálculos del servidor, sin recalcular políticas ni devoluciones.

- Tramos: `mas_de_30`, `de_15_a_30`, `menos_de_15`, contados respecto del **cobro del saldo**. Se explica que la retención se aplica a la seña y el saldo pagado se devuelve entero.
- El diálogo presenta cuatro importes, incluso una devolución de cero. **Conservar reserva** tiene foco inicial; Escape cierra sin cancelar. Las pendientes mantienen un diálogo simple.
- Se bloquean clics repetidos durante la consulta y cancelación. Si la vista previa falla o no es válida, no se envía el POST.
- `POST /reservas/cancelar`, body `{ "reserva_id": 42 }`: muestra `ok` o `error` tal cual. Una devolución pendiente se informa como pendiente, sin prometer que ya se recibió.
- Ante pérdida de conexión después del POST, se pide actualizar las reservas para comprobar el resultado; no se repite la cancelación automáticamente.
- Un `tx_hash` válido se puede consultar como identificador. El backend actual no informa red ni modalidad de devolución: por eso no se inventa un enlace a BaseScan. Queda preparado para `devolucion.red: 84532` y `devolucion.simulado: false` cuando exista esa metadata explícita.

## Modalidades y recuperación

**Simulada:** el botón dice **Pagar (simulado)**. Genera un hash mediante `crypto.getRandomValues`, sin cargar viem ni acceder a MetaMask. Evita los sufijos reservados por el verificador de prueba (`dead`: rechazo; `0000`: pendiente permanente). El identificador no enlaza a BaseScan porque no existe una transacción blockchain.

**Real:** conecta MetaMask, verifica Base Sepolia, cuenta, contrato y saldo; simula y ejecuta `writeContract` sobre `pago.contrato`, con `pago.funcion` y `value: BigInt(monto_wei)`. ABI mínimo: `pagarSena(uint256)` o `pagarSaldo(uint256)`, payable. No contiene claves privadas ni contratos ficticios de reemplazo.

El hash se guarda en **sessionStorage**, separado por usuario, reserva y tipo. Una recarga permite retomar la confirmación con el mismo hash; no solicita otra firma. Este almacenamiento corresponde a la pestaña y no constituye un registro permanente o compartido entre dispositivos.

Dobles clics quedan bloqueados. Web Locks impide ejecuciones simultáneas mientras está tomado el bloqueo, pero no reemplaza la validación de unicidad en backend y contrato. Un resultado incierto de MetaMask conserva el intento y ofrece recuperar el hash manualmente, sin firmar otra vez. Un 202 mantiene el botón deshabilitado durante la consulta automática. El temporizador se cancela al salir o al alcanzar 2 minutos; nunca se descarta el hash por agotar la espera.

## Archivos y verificación

- `pagos-modelo.js`: conversiones exactas, validación de cotización y cancelación, acciones y vencimientos.
- `billetera.js`: integración viem para pagos reales.
- `pagar.js`, `pagar.html`, `pagar.css`: presentación, simulación, confirmación y recuperación.
- `detalle-alojamiento.js`, `mis-reservas.js`: navegación, permisos, saldo y plazos.

```sh
node --test tests/*.test.cjs
```

Tests de Node: pesos ↔ wei, permisos, fechas, reserva con seña cero, simulación sin wallet, ejecución real mediante dobles de viem, códigos 200/202/402/409, reintentos, recarga, almacenamiento y prevención de envíos repetidos.

Recorridos de navegador con respuestas locales: pago simulado sin extensión, 202 repetido con el mismo hash, 402 con hash nuevo, 409 bloqueado, recuperación tras recarga, saldo y fecha vencida, escritorio y móvil de 390 px. Incluyen vista previa y rechazo de cancelación, devolución pendiente/confirmada, saldo vencido pagable y pausa de 2 minutos con recuperación del mismo hash. Son respuestas locales basadas en el contrato del backend integrado; no acreditan una operación real de punta a punta ni el estado del despliegue en Railway.

Verificación del 06/11: 111/111 tests de Node (incluidos los 11 de liquidaciones integrados por Agus) y recorrido de navegador en escritorio (1440 px) y móvil (390 px). Evidencias y comparación con el frontend previo en el documento de cambios de Justi. Los pendientes externos siguen siendo contrato/verificador/firmador reales y validación conjunta en Base Sepolia.
