// Subida de las fotos de una unidad: el archivo va directo del navegador a Cloudinary, y después se le manda
// al backend la URL que devolvió Cloudinary (POST /unidades/fotos/agregar). El backend nunca recibe el archivo:
// Railway borra el disco en cada despliegue, así que no puede guardar imágenes.
// Está separada de la página para que se pueda reusar, y para que el cambio a subidas firmadas (pendiente:
// el backend va a dar una firma y el preset pasa a "Signed") se haga en un solo lugar.
// Se incluye después de unidades-comun.js (usa CLOUDINARY_CUENTA, CLOUDINARY_PRESET y pedirAlBack).

const TIPOS_DE_FOTO = ['image/jpeg', 'image/png', 'image/webp'];
const TAMANIO_MAXIMO_FOTO = 5 * 1024 * 1024;   // 5 MB

// Controla en el navegador que el archivo sea una foto que aceptamos. Devuelve el motivo si no lo es, o null.
function problemaDeLaFoto(archivo) {
    if (!TIPOS_DE_FOTO.includes(archivo.type)) {
        return 'tiene que ser JPG, PNG o WEBP';
    }
    if (archivo.size > TAMANIO_MAXIMO_FOTO) {
        return 'pesa más de 5 MB';
    }
    return null;
}

// Sube un archivo a Cloudinary y devuelve la URL segura de la imagen.
// Sin credentials: es otro sitio y no tiene que llevar nuestra cookie. Lanza un error si Cloudinary no la acepta.
async function subirACloudinary(archivo) {
    const formulario = new FormData();
    formulario.append('file', archivo);
    formulario.append('upload_preset', CLOUDINARY_PRESET);

    const respuesta = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CUENTA}/image/upload`, {
        method: 'POST',
        body: formulario,
    });
    const resultado = await respuesta.json();
    if (!respuesta.ok) {
        throw new Error(resultado.error?.message ?? `Cloudinary respondió ${respuesta.status}`);
    }
    return resultado.secure_url;
}

// Sube las fotos de a una, en el orden en que se eligieron, y las agrega a la unidad.
// avisarProgreso(texto) se llama antes de cada una ("Subiendo 2 de 3..."), para anunciarlo en la página.
// Si una falla, sigue con las demás. Devuelve { fotos, errores }:
//   fotos: la lista actualizada que devolvió el backend con la última foto agregada (null si no se agregó ninguna);
//   errores: un mensaje por cada foto que no se pudo agregar, que dice cuál y por qué.
async function subirFotos(unidadId, archivos, avisarProgreso) {
    let fotos = null;
    const errores = [];

    for (const [indice, archivo] of [...archivos].entries()) {
        avisarProgreso(`Subiendo ${indice + 1} de ${archivos.length}...`);

        const problema = problemaDeLaFoto(archivo);
        if (problema !== null) {
            errores.push(`"${archivo.name}" ${problema}.`);
            continue;
        }

        let url;
        try {
            url = await subirACloudinary(archivo);
        } catch (error) {
            console.error(`No se pudo subir "${archivo.name}" a Cloudinary:`, error);
            errores.push(`"${archivo.name}" no se pudo subir. Revisá tu conexión y volvé a intentar.`);
            continue;
        }

        try {
            const { respuesta, resultado } = await pedirAlBack('/unidades/fotos/agregar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ unidad_id: unidadId, url }),
            });
            if (respuesta.ok) {
                fotos = resultado.fotos;
            } else {
                errores.push(`"${archivo.name}": ${resultado.error}.`);
            }
        } catch (error) {
            console.error('No se pudo conectar con el back:', error);
            errores.push(`"${archivo.name}": ${MENSAJE_SIN_CONEXION}`);
        }
    }

    return { fotos, errores };
}
