// Datos, fotos y depósito de una unidad (vistas/unidades/datos-unidad.html?id=5).
// Pide al backend los datos de la unidad y arma tres secciones: los datos básicos (POST /unidades/editar),
// las fotos (subir, elegir la principal y quitar) y el depósito de garantía (POST /unidades/deposito).
// No usa proteger-pagina.js porque la ven dos roles (propietario y administrador): quién puede ver ESTA unidad
// lo decide el backend (responde 404 a cualquier otro). Al administrador solo le queda el depósito.

const MAXIMO_FOTOS = 10;   // el mismo límite que el backend

const mensajeError = document.getElementById('mensaje-error');
let unidad;   // la unidad que devolvió el backend (el nombre se actualiza al guardar los datos)

// Muestra un error en lugar de la unidad (sin conexión, unidad inexistente o ajena)
function mostrarError(texto) {
    mensajeError.textContent = texto;
    document.body.hidden = false;
}

// El aviso (aria-live) y el error (role="alert") de una sección: "datos", "fotos" o "deposito"
function aviso(seccion) {
    return document.querySelector(`[data-aviso="${seccion}"]`);
}
function errorDe(seccion) {
    return document.querySelector(`[data-error="${seccion}"]`);
}

// Hace un POST al backend con un cuerpo JSON. Devuelve { respuesta, resultado }; si el back no responde,
// devuelve un resultado con MENSAJE_SIN_CONEXION como error (así cada sección lo muestra igual que los demás).
async function enviarAlBack(ruta, datos) {
    try {
        return await pedirAlBack(ruta, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos),
        });
    } catch (error) {
        console.error('No se pudo conectar con el back:', error);
        return { respuesta: { ok: false }, resultado: { error: MENSAJE_SIN_CONEXION } };
    }
}

// Pone el nombre de la unidad en el título de la página y de la pestaña
function mostrarNombre() {
    document.getElementById('nombre-unidad').textContent = unidad.nombre;
    document.title = `Datos de ${unidad.nombre}`;
}

// ---------- Datos ----------

// Precarga el formulario de los datos con lo que está guardado
async function prepararDatos() {
    const form = document.getElementById('form-datos');
    form.elements.nombre.value = unidad.nombre;
    form.elements.direccion.value = unidad.direccion;
    form.elements.capacidad.value = unidad.capacidad;
    form.elements.caracteristicas.value = unidad.caracteristicas ?? '';
    try {
        await cargarLocalidades(form.elements.localidad_id, unidad.localidad_id);
    } catch (error) {
        console.error('No se pudo conectar con el back:', error);
        errorDe('datos').textContent = MENSAJE_SIN_CONEXION;
        form.querySelector('button[type="submit"]').disabled = true;
    }

    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();   // frena el envío clásico del form: lo manejamos nosotros
        const boton = form.querySelector('button[type="submit"]');
        aviso('datos').textContent = '';
        errorDe('datos').textContent = '';

        boton.disabled = true;
        const datos = { unidad_id: unidad.id, ...Object.fromEntries(new FormData(form)) };
        const { respuesta, resultado } = await enviarAlBack('/unidades/editar', datos);
        boton.disabled = false;

        if (!respuesta.ok) {
            errorDe('datos').textContent = resultado.error;
            return;
        }
        unidad.nombre = form.elements.nombre.value.trim();
        mostrarNombre();
        dibujarFotos(fotosActuales);   // el texto alternativo de las fotos lleva el nombre
        aviso('datos').textContent = `${resultado.ok}.`;
    });
}

// ---------- Fotos ----------

let fotosActuales = [];
let fotosOcupadas = false;   // true mientras se sube, se quita o se elige una foto: no se aceptan otras acciones

// Un elemento de la foto por su data-campo
function campo(elemento, nombre) {
    return elemento.querySelector(`[data-campo="${nombre}"]`);
}

// Dibuja la lista de fotos (la principal primero), la cantidad ("3 de 10") y habilita o no la subida
function dibujarFotos(fotos) {
    fotosActuales = fotos;
    const lista = document.getElementById('lista-fotos');
    lista.replaceChildren();

    for (const [indice, foto] of fotos.entries()) {
        const numero = indice + 1;
        const item = document.getElementById('plantilla-foto').content.cloneNode(true);
        const imagen = campo(item, 'imagen');
        imagen.src = fotoConAncho(foto.url, 400);
        imagen.alt = `Foto ${numero} de ${unidad.nombre}`;
        campo(item, 'leyenda').textContent = foto.orden === 0 ? `Foto ${numero}: la principal` : `Foto ${numero}`;

        // el texto oculto completa el nombre del botón para el lector de pantalla: "Quitar la foto 2"
        const principal = item.querySelector('[data-accion="principal"]');
        if (foto.orden === 0) {
            principal.remove();   // ya es la principal
            item.querySelector('li').classList.add('principal');
        } else {
            campo(item, 'foto-principal').textContent = ` la foto ${numero}`;
            principal.addEventListener('click', () => elegirPrincipal(foto, numero));
        }
        campo(item, 'foto-quitar').textContent = ` la foto ${numero}`;
        item.querySelector('[data-accion="quitar"]').addEventListener('click', () => quitarFoto(foto, numero));

        lista.appendChild(item);
    }

    document.getElementById('sin-fotos').hidden = fotos.length > 0;
    document.getElementById('cantidad-fotos').textContent = `${fotos.length} de ${MAXIMO_FOTOS} fotos`;
    const archivos = document.getElementById('archivos-fotos');
    archivos.disabled = fotos.length >= MAXIMO_FOTOS || fotosOcupadas;
    document.getElementById('ayuda-fotos').textContent = fotos.length >= MAXIMO_FOTOS
        ? `Llegaste al máximo de ${MAXIMO_FOTOS} fotos. Para subir otra, quitá alguna.`
        : 'JPG, PNG o WEBP, de hasta 5 MB cada una. Podés elegir varias a la vez.';
    for (const boton of lista.querySelectorAll('button')) {
        boton.disabled = fotosOcupadas;
    }
}

// Marca la sección de fotos como ocupada (o libre) y vuelve a dibujarla para deshabilitar (o habilitar) los botones
function ocuparFotos(ocupadas) {
    fotosOcupadas = ocupadas;
    dibujarFotos(fotosActuales);
}

// Muestra los errores de la sección de fotos: uno solo como texto, varios en una lista
function mostrarErroresDeFotos(errores) {
    const contenedor = errorDe('fotos');
    contenedor.replaceChildren();
    if (errores.length === 1) {
        const parrafo = document.createElement('p');
        parrafo.textContent = errores[0];
        contenedor.appendChild(parrafo);
    } else if (errores.length > 1) {
        const lista = document.createElement('ul');
        for (const error of errores) {
            const item = document.createElement('li');
            item.textContent = error;
            lista.appendChild(item);
        }
        contenedor.append('No pudimos agregar estas fotos:', lista);
    }
}

// Elige la foto principal y anuncia el resultado. El foco va al título de las fotos, porque la lista se redibuja.
async function elegirPrincipal(foto, numero) {
    aviso('fotos').textContent = '';
    mostrarErroresDeFotos([]);
    ocuparFotos(true);
    const { respuesta, resultado } = await enviarAlBack('/unidades/fotos/principal', { unidad_id: unidad.id, foto_id: foto.id });
    fotosOcupadas = false;

    if (!respuesta.ok) {
        dibujarFotos(fotosActuales);
        mostrarErroresDeFotos([resultado.error]);
        return;
    }
    dibujarFotos(resultado.fotos);
    document.getElementById('titulo-fotos').focus();
    aviso('fotos').textContent = `La foto ${numero} es ahora la principal.`;
}

// Quita una foto, con confirmación, y anuncia el resultado. El foco va al título de las fotos.
async function quitarFoto(foto, numero) {
    if (!await confirmar({
        titulo: `¿Quitar la foto ${numero}?`,
        detalle: 'Deja de verse en la publicación. Si es la principal, la siguiente pasa a ser la principal.',
        textoConfirmar: 'Quitar',
    })) {
        return;
    }
    aviso('fotos').textContent = '';
    mostrarErroresDeFotos([]);
    ocuparFotos(true);
    const { respuesta, resultado } = await enviarAlBack('/unidades/fotos/quitar', { unidad_id: unidad.id, foto_id: foto.id });
    fotosOcupadas = false;

    if (!respuesta.ok) {
        dibujarFotos(fotosActuales);
        mostrarErroresDeFotos([resultado.error]);
        return;
    }
    dibujarFotos(resultado.fotos);
    document.getElementById('titulo-fotos').focus();
    aviso('fotos').textContent = `Quitamos la foto ${numero}.`;
}

// Al elegir archivos, los sube de a uno (subir-fotos.js) anunciando el progreso, y redibuja la lista al terminar
function prepararFotos() {
    dibujarFotos(unidad.fotos);

    const archivos = document.getElementById('archivos-fotos');
    archivos.addEventListener('change', async () => {
        const elegidos = [...archivos.files];
        if (elegidos.length === 0) {
            return;
        }
        mostrarErroresDeFotos([]);
        ocuparFotos(true);

        const { fotos, errores } = await subirFotos(unidad.id, elegidos, (texto) => {
            aviso('fotos').textContent = texto;
        });

        archivos.value = '';   // así se puede volver a elegir el mismo archivo
        fotosOcupadas = false;
        dibujarFotos(fotos ?? fotosActuales);
        const agregadas = elegidos.length - errores.length;
        if (agregadas === 0) {
            aviso('fotos').textContent = '';   // los motivos los anuncia el error (role="alert")
        } else {
            aviso('fotos').textContent = agregadas === 1 ? 'Agregamos 1 foto.' : `Agregamos ${agregadas} fotos.`;
        }
        mostrarErroresDeFotos(errores);
    });
}

// ---------- Depósito ----------

// Precarga el depósito y lo guarda (lo pueden cambiar el propietario y el administrador)
function prepararDeposito() {
    const form = document.getElementById('form-deposito');
    form.elements.deposito_garantia.value = unidad.deposito_garantia ?? '';

    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        const boton = form.querySelector('button[type="submit"]');
        aviso('deposito').textContent = '';
        errorDe('deposito').textContent = '';

        boton.disabled = true;
        const { respuesta, resultado } = await enviarAlBack('/unidades/deposito', {
            unidad_id: unidad.id,
            deposito_garantia: form.elements.deposito_garantia.value,
        });
        boton.disabled = false;

        if (!respuesta.ok) {
            errorDe('deposito').textContent = resultado.error;
            return;
        }
        form.elements.deposito_garantia.value = resultado.deposito_garantia ?? '';
        aviso('deposito').textContent = resultado.deposito_garantia === null
            ? 'Guardamos el depósito: la unidad no pide depósito.'
            : `Guardamos el depósito: ${formatearPrecio(resultado.deposito_garantia)}.`;
    });
}

// ---------- Página ----------

// Arma la página: controla la sesión, arma el menú, pide los datos de la unidad y prepara cada sección
async function cargarPagina() {
    let usuario;
    try {
        usuario = await obtenerSesion();
    } catch (error) {
        mostrarPantallaSinConexion(error);
        return;
    }
    if (usuario === null) {   // sin sesión: al login
        window.location.href = '../sesion/inicio-sesion.html';
        return;
    }
    armarMenu(usuario.rol);

    const id = idUnidadDeLaUrl();
    if (id === null) {
        mostrarError('No encontramos esa unidad.');
        return;
    }

    let respuesta;
    let resultado;
    try {
        ({ respuesta, resultado } = await pedirAlBack(`/unidades/datos?id=${encodeURIComponent(id)}`));
    } catch (error) {
        console.error('No se pudo conectar con el back:', error);
        mostrarError(MENSAJE_SIN_CONEXION);
        return;
    }
    if (!respuesta.ok) {
        mostrarError(resultado.error);
        return;
    }
    unidad = resultado.unidad;

    document.getElementById('enlace-volver').href = `configurar-unidad.html?id=${unidad.id}`;
    mostrarNombre();
    if (unidad.es_propietario) {
        prepararFotos();
        await prepararDatos();
    } else {
        // el administrador solo puede cambiar el depósito
        for (const seccion of document.querySelectorAll('[data-solo-propietario]')) {
            seccion.remove();   // se quita (no solo se oculta) para que el lector de pantalla no la cuente
        }
    }
    prepararDeposito();

    document.getElementById('unidad').hidden = false;
    document.body.hidden = false;
}

cargarPagina();
