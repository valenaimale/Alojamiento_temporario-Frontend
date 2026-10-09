// Si el usuario ya es propietario, esta página no tiene sentido: va a "Mis propiedades".
// (proteger-pagina.js lo deja pasar, porque el propietario también entra a las páginas de huésped)
async function redirigirSiYaEsPropietario() {
    let usuario;
    try {
        usuario = await obtenerSesion();
    } catch (error) {   // el back no respondió: proteger-pagina.js ya muestra el aviso
        return;
    }
    if (usuario !== null && usuario.rol === 'propietario') {
        window.location.href = '../homes/index-propietario.html';
    }
}
redirigirSiYaEsPropietario();

const formPropietario = document.getElementById('form-hacerme-propietario');
formPropietario.addEventListener('submit', async (evento) => {
    evento.preventDefault();   // frena el envío clásico del form: lo manejamos nosotros

    const mensajeError = document.getElementById('mensaje-error');
    mensajeError.textContent = '';   // borra el error del intento anterior
    const datos = Object.fromEntries(new FormData(formPropietario));   // {cobra_iva, cuit, razon_social, domicilio_fiscal}
    if (datos.cobra_iva !== '1') {   // si no cobra IVA, solo se manda cobra_iva
        delete datos.cuit;
        delete datos.razon_social;
        delete datos.domicilio_fiscal;
    }

    let respuesta;
    let resultado;
    try {
        respuesta = await fetch('http://localhost:8000/hacerse-propietario', {
            method: 'POST',
            credentials: 'include',   // para que viaje la cookie de sesión: el back saca de ahí quién es el usuario
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos),
        });
        resultado = await respuesta.json();
    } catch (error) {   // el back no respondió (apagado o sin internet)
        console.error('No se pudo conectar con el back:', error);
        mensajeError.textContent = MENSAJE_SIN_CONEXION;
        return;
    }

    if (respuesta.ok) {
        // la sesión ya tiene el rol nuevo, así que el menú va a mostrar "Mis propiedades"
        window.location.href = '../homes/index-propietario.html';
    } else {
        mensajeError.textContent = resultado.error;
    }
});
