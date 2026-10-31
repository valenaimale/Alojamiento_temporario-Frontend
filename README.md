# HayLugar · Frontend

Aplicación de alojamientos temporarios implementada con HTML, CSS y JavaScript nativos. No requiere framework ni compilación. Las vistas están en `vistas/`, los estilos en `estilos/` y la lógica de interfaz en `funcionalidades/`.

## Antes de sumar o modificar pantallas

Leer la **[Guía de diseño y experiencia de HayLugar](docs/guia-diseno.md)**. Define marca, colores, componentes, formularios, navegación, calendario, tono, accesibilidad y criterios de revisión. Incluye referencias a pantallas existentes, ejemplos y un checklist para contribuciones.

La dirección busca una experiencia simple, clara y cuidada, inspirada en la jerarquía y facilidad de uso de Airbnb. HayLugar mantiene su identidad y las reglas de negocio de la aplicación.

## Documentación

- [Guía de diseño y experiencia](docs/guia-diseno.md): cómo mantener coherencia al continuar el producto.
- [Registro del rediseño](docs/redisenio-haylugar.md): qué se implementó y cómo se validó.
- [Antes y después](docs/comparacion/README.md): 123 capturas, comparador de 31 vistas y galerías de mejoras funcionales.
- [Créditos de fotografías de destinos](imagenes/destinos/README.md).

## Levantar el frontend y ver las capturas

Desde la raíz del repositorio:

```sh
python3 -m http.server 5500
```

Abrir `http://localhost:5500/vistas/homes/index-sin-sesion.html`. Las funciones de la app requieren el backend configurado en `http://localhost:8000`; consultar su [README](https://github.com/valenaimale/Alojamiento_temporario-Backend#readme) para configurar dependencias, base de datos y migraciones.

El comparador se abre en **http://localhost:5500/docs/comparacion/** y funciona sin backend. Las imágenes también se pueden consultar directamente en GitHub desde su [índice](docs/comparacion/README.md).

## Ramas y revisión

Trabajar en una rama descriptiva y abrir un PR hacia `main`. No hacer push directo ni integrar sin revisión y controles aprobados. El workflow de este repositorio comprueba sintaxis JavaScript y ejecuta los tests con Node.js 24.

Esta entrega requiere los cambios coordinados del backend en `feature/haylugar-entrega4`. Antes de activar el código nuevo, aplicar allí las migraciones `20261031150000_agregar_recuperacion_contrasenia.php` y `20261031190000_agregar_estadias_y_libro.php` sobre la base correspondiente, siguiendo su documentación. La imagen de producción no aplica estas migraciones automáticamente.

La configuración de Vercel dirige `/api/*` al backend de producción. Una preview del frontend por sí sola no habilita los endpoints nuevos: revisar ambos repositorios juntos en local y coordinar migraciones e integración del backend antes del frontend. La confirmación por pago sigue pendiente.


## Pruebas de comportamiento

Con Node.js que incluya `node:test`, desde la raíz del repositorio:

```sh
node --test tests/*.test.cjs
```

No requiere paquetes adicionales. Cubre calendario, respuestas de cotización fuera de orden, cambios de viajeros, guardado de reserva, sesión vencida/fallos, límite de fotos y reenvío de movimientos de estadías. Los tests de DOM/HTTP simulado no sustituyen la comprobación visual ni las pruebas de API del backend.


### Estadías y libro de huéspedes

RF-10: registro desde la agenda del operador, con notas, hora y reenvío de movimientos pendientes. RF-20: datos por reserva desde Mis reservas; consulta mensual y CSV desde administración/calendario de la unidad. Nuevos patrones documentados en [guía de diseño](docs/guia-diseno.md#12-estadías-y-huéspedes). Requiere la migración de estadías/libro del backend.
