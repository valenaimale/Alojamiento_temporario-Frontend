# HayLugar · Rediseño del frontend

Registro de implementación del 31 de octubre de 2026. Se conserva HTML, CSS y JavaScript nativos y las rutas existentes. El rediseño inicial mantuvo los contratos del backend; las mejoras funcionales posteriores agregan endpoints y migraciones coordinadas. No requiere framework ni compilación. El nombre elegido es **HayLugar**.

Para sumar pantallas o componentes, consultar la **[Guía de diseño y experiencia](guia-diseno.md)**. Esa guía define criterios para continuar el producto; este documento conserva el registro de lo implementado y verificado.

## Dirección visual

Blanco, texto oscuro y verde `#1f6f54` como acento; estados diferenciados también por texto. Botones con jerarquía clara, inputs de 48 px, bordes discretos, tipografía del sistema y foco visible. Las fotografías tienen protagonismo en la exploración. Sin métricas, reseñas o disponibilidad inventadas.

`estilos/style.css` concentra fundamentos y componentes. `estilos/haylugar.css` contiene composiciones por tarea y ajustes responsivos. `estilos/busqueda.css` y `estilos/calendario-unidad.css` contienen los dos flujos principales. `funcionalidades/interfaz.js` agrega navegación al contenido, ayuda de validación y visibilidad de contraseñas.

## Cambios

- Búsqueda agrupada en destino, fechas y huéspedes. Un carrusel de destinos y un listado más amplio debajo, alimentados por las localidades existentes. Elegir destino completa el buscador; no simula resultados sin fechas.
- Resultados y detalle con fotografías, precio y condiciones jerarquizados. En móvil, las cifras del calendario se abrevian; el precio exacto permanece en la etiqueta accesible y en el resumen de la estadía.
- Calendario único de gestión con selección de primera y última noche, ambas incluidas. El mismo rango sirve para precio, temporada/mínimo y bloqueo. Reservas y bloqueos existentes se distinguen sobre el calendario; el panel muestra motivo y autor del bloqueo. Los detalles de actividad quedan desplegables.
- Se mantienen ambas rutas anteriores, `temporadas-unidad.html` y `disponibilidad-unidad.html`, apuntando al calendario compartido. Sus antiguos scripts y estilos no se cargan en esas vistas.
- Administradores asignados consultan información y gestionan bloqueos; precios, temporadas y publicación conservan su autorización de propietario. El servidor sigue validando cada operación.
- Formularios de cuenta agrupados, contraseñas visibles bajo demanda, autocompletado y errores junto al campo. Se conservan campos obligatorios por contrato; no se eliminan verificaciones del backend para reducir inputs.
- Perfiles, alta y configuración, reservas y paneles operativos comparten la identidad visual.

## Calendario y consistencia

`calendario-modelo.js` concentra reglas de fechas sin hora. El egreso de una reserva es exclusivo; el último día de un bloqueo es inclusivo. La selección admite hasta 366 noches. El día actual se obtiene en la zona de Argentina.

`calendario-unidad.js` carga precios, temporadas, reservas y bloqueos. Si falla alguna fuente, retira las celdas y deshabilita cambios hasta reintentar. Una respuesta anterior no pisa una navegación más reciente. Al guardar, se bloquean los controles; ante error se conserva el formulario. Los días pasados no se presentan como disponibilidad histórica completa, porque la API de reservas solo informa reservas vigentes.

## Validación local

- Cinco pruebas de reglas de fecha: rangos inclusivos, fechas reales y bisiestas, límite de 366 noches, egreso exclusivo, bloqueos inclusivos, cruces de mes y ausencia de precio.
- Revisión de sintaxis JavaScript, referencias locales de las 30 vistas e IDs duplicados.
- Navegación con los cinco roles y revisión desktop a 1440 × 1000 px; revisión móvil a 390 × 844 px.
- Búsqueda y detalle, cambios y restauración de precios, alta/liberación de un bloqueo de prueba, rechazo de bloqueo sobre una reserva y validación de temporadas superpuestas.
- Integraciones externas de Google y subida de archivos no verificadas de extremo a extremo. El retorno de OAuth se capturó sin token, mostrando su redirección de error. No se implementó el cobro de la seña.

Para las pruebas puras, ejecutar desde este repositorio:

```sh
node --test tests/calendario-modelo.test.cjs
```

## Preview y comparativas

El [índice de comparativas](comparacion/README.md) incluye 123 imágenes: 93 del rediseño general (31 vistas en tres etapas), 16 de mejoras funcionales posteriores y 14 de estadías/libro. El visor y las capturas están incluidos en `docs/comparacion/`, con enlaces de imágenes navegables desde GitHub.

Para abrir el visor, servir la raíz del frontend con `python3 -m http.server 5500` y visitar `http://localhost:5500/docs/comparacion/`. No requiere backend. Para usar la aplicación completa, seguir el README de ambos repositorios y configurar la API local en `http://localhost:8000`.

Las primeras 93 capturas cubren las 30 páginas originales y una variante de calendario para administrador. Usan las mismas cuentas sintéticas, viewport desktop de 1440 × 1000 y página completa; altura variable. El original corresponde al commit `54ca5fd6a35ea5db98bf6634c1c51a094fc01cb9`. Se preservan las tres etapas históricas; las correcciones posteriores tienen galerías separadas.

## Segunda pasada de usabilidad

- Los resultados muestran primero alojamientos y precio total. La búsqueda permanece resumida y se expande para modificar criterios. Los estados sin resultados, datos inválidos y fallos de conexión ofrecen una acción concreta. Las tarjetas completas enlazan al detalle y conservan foco de teclado.
- El alta empieza con nombre, capacidad, localidad y dirección. Descripción y depósito quedan en desplegables opcionales. La validación abre un desplegable si contiene un campo inválido.
- El panel del propietario permite abrir directamente el calendario. Datos, condiciones y equipo incluyen navegación compartida. El administrador ve solamente sus secciones permitidas y la etiqueta Depósito coincide con su alcance.
- El resumen de la unidad prioriza estado, siguiente paso, calendario y acceso al anuncio publicado. La asignación de administrador, operador y edición de comisión se despliegan cuando se necesitan.
- Mis reservas separa próximas estadías e historial usando los datos existentes. Presenta ingreso, egreso, huéspedes, noches y total antes de los importes detallados y la cancelación. Conserva confirmación previa y mensajes de error.
- No cambia contratos, permisos del servidor ni datos comerciales. Las comprobaciones de esta pasada no crearon ni cancelaron reservas, ni asignaron integrantes del equipo.

Verificación específica: búsqueda con resultados, búsqueda sin coincidencias y recuperación; acceso al detalle conservando criterios; navegación de propietario y administrador; apertura de formularios opcionales y validación; pestañas de reservas e historial vacío; apertura y cierre de la confirmación de cancelación; revisión a 1440 × 1000 y 390 × 844 px. En móvil se revisaron resultados (plegados y desplegados), reservas, alta, datos y equipo; sin desborde horizontal.

El visor permite comparar la segunda pasada visual con el original de GitHub o con la primera propuesta. Se actualizaron nueve capturas desktop afectadas; las otras 22 permanecen iguales. La primera propuesta se conserva en `comparacion/iteracion-1/`. `revision-2.json` identifica las capturas actualizadas.

## Seguimiento de la devolución de Entrega 4

Después de las dos pasadas visuales, se corrigió el requisito de DNI para reservar: el backend rechaza cuentas sin documento y el detalle enlaza a completar datos, conservando fechas y cantidad de huéspedes al volver. Esta corrección funcional sí requiere publicar cambios coordinados en ambos repositorios. No completa por sí sola el registro de todos los ocupantes ni los pagos.

Se retiró el bloque de créditos de la home. Se reemplazaron cuatro fotografías por alternativas bajo Unsplash License; la imagen CC0 se conserva. Las fuentes están en `imagenes/destinos/README.md`.

Las [capturas de mejoras posteriores](comparacion/mejoras/README.md) conservan el antes/después del DNI, la home, el acceso a recuperación y las fotos. Las 93 capturas del rediseño inicial no se sobrescriben.

## Recuperación de contraseña

Se agregó «Olvidé mi contraseña» en inicio de sesión y dos pantallas: `recuperar-contrasenia.html` y `restablecer-contrasenia.html`, dentro de `vistas/sesion/`. Usan los componentes existentes y `estilos/recuperacion-contrasenia.css` para espaciados específicos.

El primer paso pide solo mail y muestra una respuesta genérica, con reenvío al minuto y opción de corregir el mail. El segundo pide contraseña y confirmación; permite mostrarla y ofrece recuperación ante enlaces ausentes o vencidos. Los estados de éxito cambian el foco al mensaje; los errores se anuncian con `role="alert"`. El token entra por fragmento de URL, se borra del historial y no se persiste.

Requiere los nuevos endpoints y la migración del backend: ver `docs/api/recuperacion-contrasenia.md` en ese repositorio. El cambio es funcional y necesita publicar ambos repos coordinadamente. No modifica el modelo de alta ni crea contraseñas para cuentas exclusivamente Google.

Se verificaron la solicitud desde navegador, el reenvío limitado, las pantallas a 1440 × 1000 y 390 × 844, la ausencia de token y los estados del script con HTTP/DOM simulados. El cambio de clave completo y los correos se probaron por API con cuentas sintéticas y Mailpit. Capturas en la [galería de mejoras](comparacion/mejoras/README.md).


## Revisión funcional: fotos, cotización y sesión (31/10/2026)

- Orden de fotos con un selector de posición por foto y guardado automático: API nueva `POST /unidades/fotos/mover`, solo propietario. La foto en posición 0 sigue siendo principal. «1 · Principal» también elige portada; el resto se acomoda sin perder su orden relativo. Teclado, foco restaurado y restauración de la posición anterior ante fallo. Requiere publicar frontend y backend coordinadamente; sin migración nueva.
- Prevalidación del cupo antes de subir fotos: si el lote no entra dentro del máximo de 10, no comienza ninguna subida.
- Cotización ligada a alojamiento, ingreso, egreso y viajeros. Editar invalida precio y aceptación; las respuestas atrasadas se ignoran. Se impide enviar una reserva sin cotización vigente y repetir envíos mientras se guarda/navega. Un conflicto 409 retira cotización y recarga disponibilidad; un 401 ofrece volver a entrar conservando la búsqueda.
- Obtener sesión distingue ausencia real (401) de errores del servidor. Cerrar sesión solo redirige si la API confirma éxito; ante fallo, muestra error.
- Dirección de marca seleccionada: casa con cama. PNG aprobado como dirección; SVG definitivo e integración aún pendientes.

Validación: 28 pruebas PHP / 319 assertions para fotos, orden y alojamiento; 22 pruebas Node de calendario, cotización, sesión y cupo. Navegador desktop 1440 × 1000 y fotos en móvil 390 × 844, sin desborde horizontal; orden persistido tras recarga y operación con teclado. La unidad «Prueba de orden de fotos» es un borrador sintético local. No hubo subidas a Cloudinary ni reservas nuevas durante la comprobación visual.

La [galería de mejoras](comparacion/mejoras/README.md) conserva el antes/después de fotos; cotización documenta estados inválido y recuperado de la versión corregida.


La solución final simplifica la primera iteración: se retiraron las dos flechas y el botón «Elegir como principal», reemplazados por un solo selector. La API recibe una posición final y resuelve todo en una transacción, sin cadenas de pedidos. Nuevas capturas `fotos-selector-antes-desktop.jpg`, `fotos-selector-despues-desktop.jpg` y `fotos-selector-mobile.jpg` conservan esta comparación.

## Estadías y libro de huéspedes

- RF-10: el operador registra ingreso y egreso reales, condición de la unidad y notas. Los movimientos pendientes quedan separados por usuario, con identificador estable y reintento idempotente. La sesión se comprueba antes de enviar.
- RF-20: el titular completa sus datos y los acompañantes por reserva. Admite guardar parcialmente, controla capacidad y evita sobrescribir versiones más recientes. Propietario y administrador consultan el libro y exportan CSV; el operador no recibe los documentos del libro.
- La edición del huésped termina el día anterior al ingreso previsto, o antes si ya hubo ingreso real. El egreso finaliza la estadía sin alterar fechas contratadas, precios ni noches ocupadas.
- La agenda y Mis reservas tienen comparación antes/después; las pantallas nuevas y estados de conflicto se muestran en la [galería de estadías y libro](comparacion/estadias-libro/README.md).

## Validación acumulada y publicación

Resultado local final: **33 tests de frontend** y **356 tests / 1850 assertions de backend**, aprobados. Se comprobaron referencias locales e IDs de las 33 vistas, navegación desktop/móvil, reintentos, permisos, conflictos entre pestañas y exportación CSV con datos sintéticos. Los conteos de secciones anteriores corresponden a verificaciones parciales de cada etapa.

Cambios publicados para revisión en ramas `feature/haylugar-entrega4`, con PR hacia `main` en ambos repositorios. Se requiere integrar API y migraciones antes de activar el frontend nuevo. Consultar el README para el orden y las limitaciones de preview. La confirmación por pago y la integración del SVG definitivo de la dirección casa/cama siguen pendientes.
