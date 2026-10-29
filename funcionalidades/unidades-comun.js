// Funciones compartidas por todas las páginas de las unidades (Épicas 2 y 3): la página central de una unidad,
// el alta y la edición, las temporadas y los precios, la publicación, la búsqueda y el detalle.
// Solo define constantes y funciones. Se incluye después de sesion.js (usa URL_BACK) y antes del JS de la página.

// Cuenta de Cloudinary donde se suben las fotos de las unidades. No son datos secretos: el preset es
// "sin firma" (Unsigned), pensado para subir desde el navegador, y solo acepta imágenes en la carpeta unidades.
const CLOUDINARY_CUENTA = 'ynclnyuh';
const CLOUDINARY_PRESET = 'Alojamiento-temporario-unidades';

// El ?id= de la URL como número (configurar-unidad.html?id=5 → 5), o null si falta o no es un entero positivo.
function idUnidadDeLaUrl() {
    const id = Number(new URLSearchParams(window.location.search).get('id'));
    return Number.isInteger(id) && id > 0 ? id : null;
}

// Un monto como precio en pesos: 12500.5 o "12500.50" → "$ 12.500,50"
function formatearPrecio(monto) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(monto));
}

// Un porcentaje del backend como se lee acá: "15.00" → "15 %", "17.50" → "17,5 %"
function formatearPorcentaje(valor) {
    return `${Number(valor).toLocaleString('es-AR')} %`;
}

// Una fecha del backend como se lee acá: "2026-10-05" → "05/10/2026".
// Se corta el texto en lugar de usar Date, así no hay corrimientos por zona horaria.
function formatearFecha(fecha) {
    return fecha.slice(0, 10).split('-').reverse().join('/');
}

// La URL de una foto de Cloudinary achicada a ese ancho (para tarjetas y miniaturas, así cargan rápido).
// Cloudinary arma la versión chica al vuelo con solo agregar la transformación en la URL.
function fotoConAncho(url, ancho) {
    return url.replace('/image/upload/', `/image/upload/c_limit,w_${ancho},q_auto,f_auto/`);
}

// Hace una petición al backend con la cookie de sesión y devuelve { respuesta, resultado } (resultado es el JSON).
// Si el backend no responde, lanza el error: lo atrapa quien llama (para mostrar MENSAJE_SIN_CONEXION).
async function pedirAlBack(ruta, opciones = {}) {
    const respuesta = await fetch(URL_BACK + ruta, { credentials: 'include', ...opciones });
    const resultado = await respuesta.json();
    return { respuesta, resultado };
}

// Llena un <select> con las localidades activas, agrupadas por provincia con <optgroup>
// (el lector de pantalla anuncia la provincia de cada grupo). La primera opción queda vacía: "Elegí una localidad".
// $seleccionada: el id de la localidad que tiene que quedar elegida (por ejemplo, al editar una unidad).
// Lanza el error si el backend no responde.
async function cargarLocalidades(select, seleccionada = null) {
    const { resultado } = await pedirAlBack('/localidades');

    select.replaceChildren(new Option('Elegí una localidad', ''));
    const grupos = new Map();   // provincia → su <optgroup>
    for (const localidad of resultado.localidades) {
        if (!grupos.has(localidad.provincia)) {
            const grupo = document.createElement('optgroup');
            grupo.label = localidad.provincia;
            grupos.set(localidad.provincia, grupo);
            select.appendChild(grupo);
        }
        const opcion = new Option(localidad.nombre, localidad.id);   // new Option usa textContent: el nombre nunca se interpreta como HTML
        opcion.selected = localidad.id === seleccionada;
        grupos.get(localidad.provincia).appendChild(opcion);
    }
}

// Pide al backend el resumen de una unidad (nombre, estado y qué le falta para publicarse).
// Devuelve { respuesta, resultado }: si respuesta.ok, la unidad está en resultado.unidad;
// si no, el mensaje está en resultado.error (401 sin sesión, 404 si no existe o no es suya, 422 si el id es inválido).
async function obtenerResumenUnidad(id) {
    return pedirAlBack(`/unidades/resumen?id=${encodeURIComponent(id)}`);
}

// El enlace al inicio de sesión que, después de entrar, vuelve a esta página de alojamientos (el listado o el detalle)
// con lo que tiene en la URL: la búsqueda o las fechas elegidas. inicio-sesion.js solo acepta volver a estas páginas.
function urlParaIniciarSesionYVolver() {
    const pagina = window.location.pathname.split('/').pop();   // "detalle.html" o "listado.html"
    const volver = `../alojamientos/${pagina}${window.location.search}`;
    return `../sesion/inicio-sesion.html?volver=${encodeURIComponent(volver)}`;
}

// El encabezado de las páginas públicas (el listado y el detalle de alojamientos), que se ven con o sin sesión.
// Con sesión arma el menú del usuario y muestra "Mi perfil" (#enlace-perfil); sin sesión, "Iniciar sesión" y
// "Registrarme" (#acceso). Si el back no responde, se muestra como sin sesión.
// Devuelve el usuario logueado (o null), así la página sabe quién la ve (el detalle, para reservar).
async function armarEncabezadoPublico() {
    let usuario = null;
    try {
        usuario = await obtenerSesion();
    } catch (error) {
        console.error('No se pudo conectar con el back:', error);
    }
    if (usuario === null) {
        const acceso = document.getElementById('acceso');
        // "Iniciar sesión" vuelve a esta página (con las fechas elegidas): el enlace se arma recién al tocarlo,
        // porque mientras tanto el usuario pudo cambiar las fechas
        acceso.querySelector('a[href*="inicio-sesion"]').addEventListener('click', (evento) => {
            evento.currentTarget.href = urlParaIniciarSesionYVolver();
        });
        acceso.hidden = false;
        return null;
    }
    armarMenu(usuario.rol);
    document.getElementById('enlace-perfil').hidden = false;
    return usuario;
}

// El estado de publicación como se le muestra al usuario
const NOMBRES_DE_ESTADO = {
    borrador: 'Sin publicar',
    publicada: 'Publicada',
    pausada: 'Pausada',
};

// Pide confirmación antes de una acción que no se puede deshacer, con un diálogo propio (<dialog>) en vez del confirm() del navegador.
// titulo: la pregunta ("¿Quitar a Nadia como operador?"); detalle: qué pasa si confirma; textoConfirmar: el botón ("Quitar").
// textoCancelar: el botón para no hacer nada ("Cancelar"; "Volver" cuando la acción misma es cancelar algo).
// Devuelve una promesa: true si confirma, false si cancela o cierra con Escape.
// Es modal: el foco queda adentro, arranca en el botón para no hacer nada (lo seguro) y al cerrarse vuelve al botón que lo abrió.
function confirmar({ titulo, detalle = '', textoConfirmar, textoCancelar = 'Cancelar' }) {
    const dialogo = document.createElement('dialog');
    dialogo.className = 'dialogo-confirmar';
    dialogo.setAttribute('role', 'alertdialog');
    dialogo.setAttribute('aria-labelledby', 'dialogo-confirmar-titulo');

    const encabezado = document.createElement('h2');
    encabezado.id = 'dialogo-confirmar-titulo';
    encabezado.textContent = titulo;
    dialogo.appendChild(encabezado);

    if (detalle !== '') {
        const texto = document.createElement('p');
        texto.id = 'dialogo-confirmar-detalle';
        texto.textContent = detalle;
        dialogo.appendChild(texto);
        dialogo.setAttribute('aria-describedby', texto.id);
    }

    // method="dialog": cada botón cierra el diálogo y deja su value en dialogo.returnValue
    const formulario = document.createElement('form');
    formulario.method = 'dialog';
    const cancelar = document.createElement('button');
    cancelar.value = 'cancelar';
    cancelar.className = 'boton boton-outline';
    cancelar.textContent = textoCancelar;
    cancelar.autofocus = true;
    const aceptar = document.createElement('button');
    aceptar.value = 'confirmar';
    aceptar.className = 'boton boton-primario';
    aceptar.textContent = textoConfirmar;
    formulario.append(cancelar, aceptar);
    dialogo.appendChild(formulario);

    document.body.appendChild(dialogo);
    dialogo.showModal();
    return new Promise((resolver) => {
        dialogo.addEventListener('close', () => {
            resolver(dialogo.returnValue === 'confirmar');   // con Escape, returnValue queda vacío
            dialogo.remove();
        });
    });
}
