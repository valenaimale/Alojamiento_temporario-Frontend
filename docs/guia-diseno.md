# HayLugar · Guía de diseño y experiencia

Versión 1 · 31 de octubre de 2026 · Referencia para quienes diseñan o desarrollan el frontend.

Esta guía reúne la dirección acordada y los patrones de HayLugar. Usarla antes de agregar una pantalla, modificar un formulario o incorporar una funcionalidad. Los valores de implementación se verificaron contra el CSS actual. Las recomendaciones para trabajo nuevo se identifican como tales; este documento no certifica que todas las vistas heredadas ya las cumplan.

El [registro del rediseño](redisenio-haylugar.md) describe cambios y pruebas realizadas. Esta guía explica cómo continuar el producto. La implementación y esta guía se revisan juntas mediante PR.

## 1. Qué queremos que se sienta

**Encontrar alojamiento y gestionar una estadía debe resultar simple, claro y agradable.** La interfaz tiene que ayudar a entender qué hay, qué falta y cuál es el siguiente paso.

La referencia es la simplicidad de Airbnb: espacio en blanco, buena jerarquía, fotografías útiles, búsqueda protagonista y acciones reconocibles. De las referencias de búsqueda compartidas tomamos la agrupación **destino → fechas → huéspedes → buscar**, seguida por contenido para explorar. HayLugar conserva su marca y sus funcionalidades propias.

Prioridades, en este orden:

1. Que la tarea se entienda sin explicación externa.
2. Que pida solo los datos necesarios en ese momento.
3. Que estado, precio y consecuencias sean claros.
4. Que funcione con teclado y en pantallas pequeñas.
5. Que mantenga una apariencia cuidada y coherente.

Una mejora visual no autoriza a cambiar reglas de negocio. Si un campo parece innecesario, revisar primero por qué lo exige el backend. Se puede agrupar, explicar o mostrar cuando corresponda; quitar un requisito exige resolver el contrato completo.

## 2. Marca, tono y contenido

- **Nombre:** HayLugar, con H y L mayúsculas, sin espacio. G-ONE queda como nombre anterior; no usarlo en texto nuevo para usuarios.
- **Marca visual:** dirección elegida el 31/10/2026: casa con una cama visible, para reconocer alojamiento inmediatamente. El PNG de exploración está aprobado como dirección; falta preparar el SVG final e integrarlo. Hasta esa entrega, reutilizar el encabezado y [marca.svg](../imagenes/marca.svg) actuales; no inventar variantes por pantalla.
- **Personalidad:** cercana, tranquila, útil. La confianza viene de información precisa y acciones predecibles.
- **Idioma:** español rioplatense, con voseo coherente: “Elegí”, “Buscá”, “Guardá”. Botones breves con verbo y objeto: “Crear alojamiento”, “Guardar cambios”, “Cancelar reserva”.
- **Vocabulario:** alojamiento, huésped, propietario, administrador, operador, seña y depósito de garantía. Mantener “unidad” en identificadores técnicos cuando corresponda; preferir “alojamiento” en texto nuevo para usuarios.
- **Fechas y dinero:** formato `es-AR`, moneda ARS y aclaración del alcance: por noche, por toda la estadía o seña. Reutilizar los formateadores existentes.
- Explicar qué pasó y cómo seguir: “No pudimos cargar los resultados. Revisá la conexión y volvé a intentar”. Evitar “Error inesperado” como único mensaje.
- No presentar como disponible un pago, servicio o dato que todavía no exista. El pago de la seña sigue sin estar implementado en esta versión.

## 3. Fundamentos visuales

### Colores

Fuente de verdad: [`estilos/style.css`](../estilos/style.css), bloque `:root`. Reutilizar variables en lugar de repetir hexadecimales.

| Uso | Variable actual | Valor |
| --- | --- | --- |
| Acción principal y acento | `--color-primary` | `#1f6f54` |
| Hover principal y enlaces | `--color-primary-dark` | `#18543f` |
| Fondo de selección o éxito | `--color-primary-light` | `#e8f3ed` |
| Texto principal | `--color-text` | `#222824` |
| Texto secundario | `--color-text-muted` | `#626966` |
| Fondo y superficie | `--color-bg`, `--color-surface` | `#ffffff` |
| Separadores | `--color-border` | `#e1e5e1` |
| Borde de campos | `--color-input` | `#7c8581` |
| Superficie neutra | `--color-gray-light` | `#f1f3f1` |
| Error o acción destructiva | `--color-danger` | `#b42318` |
| Fondo de error | `--color-danger-light` | `#fff0ed` |
| Información y ciertos estados pendientes | `--color-purple` | `#175cd3` |
| Fondo informativo | `--color-purple-light` | `#edf4ff` |

Los dos nombres `purple` son heredados: sus valores actuales son azules. Reutilizarlos mientras existan; cualquier cambio de nombre debe actualizar sus consumidores. El verde no se usa para decorar todos los bloques: reserva protagonismo para la acción, selección y marca.

El calendario tiene estados propios en [`calendario-unidad.css`](../estilos/calendario-unidad.css): reservado azul, bloqueado marrón y sin precio amarillo. Mostrar también texto, leyenda y etiquetas accesibles; el color por sí solo no explica un estado.

### Tipografía y medidas

| Elemento | Base actual |
| --- | --- |
| Familia | `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` |
| Cuerpo | 16 px, peso 400, interlineado 1.55 |
| H1 general | `clamp(1.8rem, 3vw, 2.4rem)`, peso 650 |
| H2 general | 1.4 rem, peso 650 |
| H3 general | 1.05 rem, peso 650 |
| Etiquetas de campos | 0.88 rem, peso 600 |
| Ayuda | 0.9 rem, color secundario |
| Inputs | Altura mínima 48 px, borde de 1 px |
| Botón estándar | Altura mínima 46 px; padding 10 × 20 px |
| Radios | `--radius-sm`: 10 px; `--radius-md`: 16 px; `--radius-pill`: 999 px |
| Sombra de tarjeta | `--shadow-card: none` |
| Foco | Contorno verde de 3 px, separado 4 px |

Inter aparece como primera preferencia, pero no se descarga una fuente web: el navegador usa la disponible en el equipo. No agregar una dependencia de tipografía para una sola vista.

Las composiciones pueden ajustar tamaños de títulos o controles. Para trabajo nuevo, partir de estas bases; justificar una excepción por contenido o interacción. Evitar títulos enormes en pantallas operativas.

### Espacio y composición

- Usar espacio y alineación para agrupar. Un título y un separador suelen alcanzar; no encerrar cada dato en una tarjeta.
- Como pauta para nuevos bloques, preferir espacios de 8, 16, 24, 32 y 40 px. No existe todavía una escala de espaciado tokenizada; estas medidas son una guía, no variables disponibles.
- El `main` general tiene ancho máximo de 1280 px y padding lateral de 40 px. A 700 px o menos, pasa a 20 px. Los formularios generales tienen máximo de 560 px; algunas tareas necesitan una composición más amplia.
- El calendario de gestión admite hasta 1440 px por su densidad. No extender esa excepción a todos los formularios.
- Mantener blanco como fondo principal, bordes suaves y sombras excepcionales. Los diálogos pueden usar sombra para separar capas.

## 4. Componentes que reutilizamos

| Necesidad | Patrón existente | Criterio |
| --- | --- | --- |
| Encabezado | `.site-header`, `.marca`, `#menu`, `.enlace-perfil` | Misma identidad y navegación según rol |
| Acción principal | `.boton.boton-primario` | Un siguiente paso dominante por tarea o formulario |
| Acción secundaria | `.boton` o `.boton.boton-outline` | Alternativa que no compite con la principal |
| Acción de texto | `.boton-texto` | Edición o acción secundaria contextual |
| Acción destructiva | `.boton-peligro` o `.accion-peligro` donde esté definida | Verbo explícito y confirmación cuando corresponda |
| Estado | `.estado` y variante existente | Nombre visible, sin depender solo del color |
| Ayuda | `.ayuda`, `.subtitulo`, `.ayuda-seccion` | Explica una decisión, requisito o consecuencia |
| Error / éxito | `.mensaje-error` / `.mensaje-ok` | `role="alert"` para error y `role="status"` para confirmación |
| Información opcional | `<details><summary>…</summary>…</details>` | Accesible sin un componente JavaScript nuevo |
| Confirmación | `confirmar()` en `unidades-comun.js` | Describe objeto, consecuencias y acción concreta |
| Secciones de alojamiento | `mostrarNavegacionUnidad()` | Calendario, datos o depósito, condiciones y equipo según permiso |
| Lista de resultados | `.resultados` y tarjeta existente | Foto, nombre, ubicación/capacidad y precio total |

Un enlace navega; un botón ejecuta una acción. No usar un `div` clickeable como sustituto. Si una tarjeta contiene varias acciones, no superponer un enlace sobre todas ellas. El enlace extendido de resultados sirve para tarjetas con un único destino.

La forma de píldora se reserva para búsqueda, perfil y controles que ya la usan. Los botones normales conservan radio de 10 px. Los iconos son simples, del mismo trazo; los decorativos llevan `aria-hidden="true"` y los botones de solo icono necesitan nombre accesible.

## 5. Formularios: pedir menos a la vez

1. Empezar por lo indispensable para completar la tarea actual.
2. Agrupar por significado con `fieldset` y `legend`; no por el orden de columnas de la base de datos.
3. Marcar los opcionales. Desplegarlos bajo demanda cuando no sean parte del camino principal.
4. Mantener etiquetas visibles. El placeholder puede dar un ejemplo, pero no reemplaza la etiqueta.
5. Usar `required`, límites, `type`, `inputmode` y `autocomplete` coherentes con el contrato real.
6. Ante error, conservar lo escrito, señalar el campo y explicar qué corregir. Si está dentro de un desplegable, abrirlo.
7. Mientras se guarda, impedir envíos duplicados e indicar el estado. Ante fallo, volver a habilitar la acción.
8. Confirmar el resultado. Si cambia la ubicación del foco o desaparece un control, llevarlo a un lugar útil.

Ejemplo de campo compatible con la validación compartida:

```html
<label for="nombre">
  Nombre del alojamiento
  <input
    id="nombre"
    name="nombre"
    type="text"
    required
    minlength="3"
    maxlength="100"
    autocomplete="off"
    aria-describedby="ayuda-nombre"
  >
</label>
<p class="ayuda" id="ayuda-nombre">Es el nombre que van a ver los huéspedes.</p>
```

[`interfaz.js`](../funcionalidades/interfaz.js) conecta los controles presentes cuando se ejecuta: agrega mensajes junto a la etiqueta contenedora, abre `details` ante un campo inválido y permite mostrar contraseñas. En campos creados después por JavaScript, verificar y conectar esas conductas expresamente; no asumir que se inicializan solos.

**Recuperar acceso:** usar [solicitud por mail](../vistas/sesion/recuperar-contrasenia.html) y [nueva contraseña](../vistas/sesion/restablecer-contrasenia.html) como referencia. Un campo para solicitar, dos para confirmar la nueva clave; respuesta genérica que no revela cuentas, reenvío limitado, errores anunciados y acción clara para pedir otro enlace. No agregar preguntas de seguridad ni exponer el token en el contenido, almacenamiento o analítica.

**Fotos:** un único selector nativo de posición por foto: «1 · Principal», «2», «3»… Elegir 1 define la portada; mover a otro lugar conserva el orden relativo del resto. Evitar agregar flechas o un botón independiente para principal. Selector de al menos 44 px, operable con teclado y táctil; guardado automático, foco sobre la foto movida y confirmación anunciada. Si falla, restaurar el orden anterior y permitir reintento. Con una sola foto, el selector queda deshabilitado. Quitar mantiene su confirmación. Rechazar un lote que supera el cupo antes de subir archivos. Mantener permisos de propietario.

**Cotización:** al editar fechas o viajeros, retirar precio y acción de reserva anteriores. Solo mostrar el resultado correspondiente a la selección vigente; ignorar respuestas atrasadas. Ante error de red o capacidad inválida, explicar cómo corregirlo. Si caduca la sesión, conservar la búsqueda en el enlace para iniciar sesión. Bloquear envíos repetidos mientras se guarda y durante la navegación posterior.

El alta actual empieza con **nombre, capacidad, localidad y dirección**. Descripción y depósito son opcionales. Fotos, precios y otras condiciones se completan después; la interfaz aclara que crear el alojamiento lo guarda como borrador.

## 6. Patrones de los flujos principales

| Flujo | Qué priorizar | Referencia de implementación |
| --- | --- | --- |
| Inicio | Destino, fechas y huéspedes; después destinos para explorar | [Inicio](../vistas/homes/index-huesped.html), `busqueda.js`, `destinos.js` |
| Resultados | Alojamientos y precio final; criterios resumidos que se pueden editar | [Listado](../vistas/alojamientos/listado.html), `listado-alojamientos.js` |
| Detalle | Fotos, capacidad, disponibilidad, total y condiciones de la estadía | [Detalle](../vistas/alojamientos/detalle.html), `detalle-alojamiento.js` |
| Reservas | Próximas / historial; fechas y total antes del detalle de importes | [Mis reservas](../vistas/reservas/mis-reservas.html), `mis-reservas.js` |
| Mis alojamientos | Estado y acceso directo a calendario o administración | [Propietario](../vistas/homes/index-propietario.html), `mis-unidades.js` |
| Crear alojamiento | Datos básicos, opcionales bajo demanda y siguiente paso claro | [Alta](../vistas/unidades/alta-unidad.html), `alta-unidad.js` |
| Configuración | Estado, faltantes, calendario y navegación entre secciones | [Resumen](../vistas/unidades/configurar-unidad.html) |
| Equipo | Integrantes actuales antes que formularios de asignación | [Equipo](../vistas/unidades/gestion-unidad.html), `gestion-unidad.js` |
| Calendario de gestión | Un rango seleccionado para operar sobre fechas | [Calendario](../vistas/unidades/temporadas-unidad.html), `calendario-unidad.js` |

Los carruseles sirven para explorar destinos; no se usan como navegación obligatoria de un formulario o para esconder avisos importantes. No inventar secciones de recomendaciones si no hay datos que las sostengan.

### Calendario: reglas que la interfaz debe conservar

- Gestión: seleccionar primera y última **noche**, ambas incluidas, y aplicar precio, temporada/mínimo o bloqueo sobre ese rango.
- Reserva de huésped: el día de egreso queda fuera de las noches ocupadas. Explicarlo con etiquetas y resumen; no reutilizar sin adaptación la selección inclusiva de gestión.
- Reservado, bloqueado y sin precio son estados distintos. Un día sin precio no se debe presentar como disponible para reservar.
- Identificar motivo y autor de los bloqueos cuando la API lo informa. No atribuir todos los bloqueos al propietario.
- Si falla alguna fuente necesaria para el calendario de gestión, bloquear edición y ofrecer reintento; no mostrar disponibilidad incompleta como si fuera segura.
- Reutilizar [`calendario-modelo.js`](../funcionalidades/calendario-modelo.js) para reglas de fechas. Las dos rutas de temporadas y disponibilidad ya comparten el calendario; evitar volver a separarlas en formularios paralelos.

## 7. Estados, permisos y accesibilidad

Toda pantalla nueva debe definir su comportamiento para carga, datos disponibles, vacío, error y falta de permiso. Toda acción de escritura debe definir guardado, éxito y fallo. Un vacío incluye explicación y una acción útil; un error permite recuperarse conservando el contexto cuando sea posible.

Los permisos los decide y valida el servidor. El frontend presenta solamente las acciones correspondientes. Por ejemplo, el administrador asignado gestiona bloqueos y depósito, mientras precios, temporadas y publicación conservan alcance de propietario. Reutilizar la comprobación de sesión y el patrón de autorización de una vista equivalente; las vistas de una unidad no siempre se pueden proteger con un único rol fijo.

Para pantallas y componentes nuevos:

- Un H1 principal, títulos en orden, `main` y navegación con nombre.
- Teclado completo, foco visible y sin trampas. Mantener `aria-current` en navegación y `aria-pressed` en botones de filtro.
- No eliminar el contorno de foco sin reemplazo equivalente.
- Mensajes y estado disponibles como texto. Vincular ayuda y error al campo mediante `aria-describedby`.
- Contraste suficiente: objetivo de 4.5:1 para texto normal y 3:1 para texto grande; comprobar la combinación real antes de introducir colores.
- Objetivo de área de interacción de al menos 44 × 44 px en nuevos controles táctiles. Hay controles compactos heredados de 28–40 px: su existencia no convierte ese tamaño en la pauta para controles nuevos.
- Respetar `prefers-reduced-motion`; las transiciones actuales son discretas y se desactivan con esa preferencia.
- Evitar información que solo aparece con hover. Dar texto alternativo útil a fotos relevantes y `alt=""` a imágenes decorativas.

## 8. Móvil y fotografías

Las composiciones generales se adaptan a 700 px; búsqueda y calendario tienen puntos intermedios propios. Mantenerlos según su contenido. Apilar campos en móvil, conservar títulos y acciones visibles y evitar scroll horizontal de toda la página. Si una tabla o carrusel necesita desplazamiento horizontal, limitarlo a su contenedor.

Revisar al menos a **1440 × 1000**, un ancho intermedio y **390 × 844**. Probar también texto largo, ampliación del navegador y contenidos vacíos; una captura de escritorio no alcanza para validar un flujo.

Las fotos de alojamientos provienen de los alojamientos. Las imágenes editoriales de destinos usan licencias que permiten mostrarlas sin atribución en pantalla. Sus fuentes quedan en [imagenes/destinos/README.md](../imagenes/destinos/README.md). No agregar bloques de créditos a la home. Los datos de preview usan una ilustración identificada como demostración. No reemplazar una foto faltante por una foto de otra propiedad ni presentar imágenes de demostración como publicaciones reales.

## 9. Qué evitar para mantener la dirección

- Degradados grandes, brillos, superficies translúcidas o animaciones ornamentales que no ayudan a una tarea.
- Una tarjeta, sombra o borde fuerte alrededor de cada elemento.
- Métricas, reseñas, descuentos, urgencia o disponibilidad inventados.
- Párrafos promocionales genéricos en pantallas de operación.
- Formularios con todos los campos y acciones visibles simultáneamente, aunque se usen pocas veces.
- Varios botones primarios compitiendo dentro de la misma decisión.
- Iconos o emojis de estilos mezclados para suplir una jerarquía poco clara.
- Nuevas pantallas, pestañas o funciones agregadas solo para llenar espacio.

Antes de sumar un elemento, poder responder: **¿qué decisión o tarea del usuario ayuda a resolver?** Si no hay respuesta concreta, simplificar.

## 10. Cómo sumar una pantalla o componente

1. Describir la tarea, quién la realiza y qué datos o permisos necesita. Acordar el alcance funcional por separado si cambia el producto.
2. Buscar una vista equivalente en la tabla de flujos. Reutilizar su encabezado, estados, autorización y componentes; no copiar lógica de permisos a ciegas.
3. Mantener HTML, CSS y JavaScript nativos. La implementación actual no requiere framework ni compilación.
4. Cargar `style.css` primero. Las vistas heredadas cargan su hoja particular y luego `haylugar.css`; el calendario agrega su hoja especializada después. Respetar la cascada existente al intervenir una vista.
5. Para una composición nueva, usar clases con alcance de página y una hoja específica si lo necesita. Evitar reglas globales como `button {…}` para resolver un caso puntual.
6. Reutilizar `sesion.js`, `menu.js`, `unidades-comun.js` e `interfaz.js` según la tarea y en el orden que requieren. Conservar IDs y nombres usados por los scripts y el backend, o actualizar todos sus consumidores juntos.
7. Implementar todos los estados del flujo y verificarlo con sus roles. No alcanza con el camino exitoso.
8. Guardar capturas desktop antes y después con igual viewport, rol, datos y estado; revisar móvil también. Identificar versiones y no sobrescribir la referencia anterior.
9. Documentar una nueva regla reutilizable aquí y su implementación en el archivo compartido correspondiente. Si cambia una decisión global, revisar las pantallas afectadas y acordarla con el equipo.

### Mapa de archivos

| Archivo | Responsabilidad |
| --- | --- |
| [`style.css`](../estilos/style.css) | Variables, tipografía, botones, campos, tarjetas, mensajes y foco |
| [`haylugar.css`](../estilos/haylugar.css) | Encabezado, composiciones por tarea y ajustes de la propuesta |
| [`busqueda.css`](../estilos/busqueda.css) | Destino, fechas y contador de huéspedes |
| [`calendario-unidad.css`](../estilos/calendario-unidad.css) | Calendario de gestión y panel de fechas |
| [`interfaz.js`](../funcionalidades/interfaz.js) | Saltar al contenido, título de marca, contraseñas y validación compartida |
| [`unidades-comun.js`](../funcionalidades/unidades-comun.js) | Utilidades, formateadores, confirmaciones y navegación de la unidad |
| [`menu.js`](../funcionalidades/menu.js) | Navegación por rol |
| [`redisenio-haylugar.md`](redisenio-haylugar.md) | Registro de implementación, pruebas y entorno local |

### Checklist para revisar una contribución

- [ ] La tarea y la acción principal se entienden al abrir la pantalla.
- [ ] Marca, vocabulario, colores, radios y tipografía siguen esta guía.
- [ ] Se reutilizan componentes; los estilos particulares no afectan otras vistas.
- [ ] Los campos necesarios y opcionales están diferenciados; no se piden datos redundantes.
- [ ] Hay carga, vacío, error y recuperación; el guardado conserva datos ante fallo.
- [ ] Fechas, noches, moneda y alcance del precio son inequívocos.
- [ ] Los permisos funcionan para cada rol y siguen validados por el backend.
- [ ] Se puede completar con teclado y el foco permanece visible.
- [ ] Funciona en escritorio, ancho intermedio y móvil, con texto largo y sin desborde de página.
- [ ] Se verificaron referencias locales, IDs, sintaxis y las pruebas pertinentes al comportamiento modificado.
- [ ] Hay capturas antes/después y se explica qué cambió, por qué y cómo se verificó.
- [ ] Si se agregó una regla compartida, se actualizó esta guía junto con el código.

## 11. Referencias visuales y límites de la documentación

El [índice de comparativas](comparacion/README.md) conserva original, primera propuesta y segunda pasada visual de 31 vistas, además de las mejoras funcionales posteriores. Capturas y visor están incluidos en `docs/comparacion/`. Se pueden revisar las imágenes desde GitHub o abrir el comparador estático al servir este repositorio; no requiere backend.

Las capturas son ejemplos de la implementación, no una especificación inmutable. Cuando el código y esta guía difieran, revisar si se trata de una limitación heredada o una decisión nueva y reconciliarlos. No propagar una inconsistencia por copiar una pantalla existente.


## 12. Estadías y huéspedes

- La agenda mantiene una acción por hecho: **Registrar ingreso** o **Registrar egreso**. El diálogo pide solo estado de la unidad y notas opcionales. Fecha/hora se toman al confirmar y se presentan en horario argentino.
- Nunca dar por realizado un ingreso por el paso del tiempo. Mostrar el hecho registrado y su hora, conservar egresos atrasados y distinguir reservas pendientes de confirmadas.
- Los movimientos sin enviar indican explícitamente que están guardados solo en este dispositivo; conservar identificador y hora en los reintentos. No mostrar éxito de servidor antes de su respuesta.
- **Datos de huéspedes** se abre desde cada reserva. Titular precargado; acompañantes se agregan uno por uno hasta la capacidad reservada. Contador de datos guardados y aviso claro si faltan personas.
- Usar `fieldset` y `legend` por persona, etiquetas visibles, campos obligatorios definidos por RF-20 y una sola acción Guardar. No agregar documentos ni domicilios al buscador.
- **Libro de huéspedes**, desde la administración/calendario del alojamiento, ofrece consulta mensual e historial. Propietario y administrador ven datos de lectura, sin controles que parezcan editables. Exportación por reserva.
- Conflicto de edición conserva el formulario. Recargar una versión guardada pide confirmación si implica perder cambios locales. Datos personales del libro nunca van a localStorage.
- Referencias de implementación: `libro-huespedes.html`, `libro-huespedes.js`, `libro-huespedes.css`, `agenda-operador.js` y `estadias-modelo.js`. Contrato: `docs/api/estadias-y-huespedes.md` del backend.
