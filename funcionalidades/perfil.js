// Carga los datos del usuario logueado en la página. Si no hay sesión, manda al login.
async function cargarPerfil() {
    let usuario;
    try {
        usuario = await obtenerSesion();   // con paréntesis: ejecuta la función; con await: espera el resultado
    } catch (error) {                     // el back no respondió: se muestra el aviso de sesion.js
        mostrarPantallaSinConexion(error);
        return;
    }

    if (usuario === null) {                   // no hay sesión: esta página no se puede ver
        window.location.href = '../homes/index-sin-sesion.html';
        return;
    }

    armarMenu(usuario.rol);//función de menu.js
    document.getElementById('saludo-nombre').textContent = `Hola, ${usuario.nombre}`;   // comillas invertidas para meter la variable
    document.getElementById('perfil-nombre').textContent = usuario.nombre;
    document.getElementById('perfil-mail').textContent = usuario.mail;
    document.getElementById('perfil-rol').textContent = usuario.rol;

    if (usuario.dni === null) {   // las cuentas creadas con Google no tienen DNI hasta que lo completan
        document.getElementById('perfil-dni').textContent = 'Sin completar';
        document.getElementById('enlace-completar-datos').hidden = false;   // la página la crea la Tarea 4
    } else {
        document.getElementById('perfil-dni').textContent = usuario.dni;
    }

    if (usuario.rol === 'huesped') {   // un huésped se puede hacer propietario sin crear otra cuenta
        document.getElementById('enlace-hacerme-propietario').hidden = false;
    }
    if (usuario.rol === 'propietario') {
        cargarDatosFiscales();
    }
}

// Pide al back los datos fiscales del propietario y los muestra en la sección "Datos fiscales".
async function cargarDatosFiscales() {
    let respuesta;
    let resultado;
    try {
        respuesta = await fetch(URL_BACK + '/datos-fiscales', {
            method: 'GET',
            credentials: 'include',
        });
        resultado = await respuesta.json();
    } catch (error) {   // el back no respondió: el resto del perfil ya está cargado, solo no se muestra esta sección
        console.error('No se pudo conectar con el back:', error);
        return;
    }
    if (!respuesta.ok) {
        return;
    }

    const fiscales = resultado.datos_fiscales;
    document.getElementById('seccion-datos-fiscales').hidden = false;
    if (!fiscales.cobra_iva) {
        document.getElementById('fiscal-sin-iva').hidden = false;
        return;
    }
    const cuit = fiscales.cuit;   // llega solo con números (20301234563) y se muestra como 20-30123456-3
    document.getElementById('fiscal-cuit').textContent = `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}`;
    document.getElementById('fiscal-razon-social').textContent = fiscales.razon_social;
    document.getElementById('fiscal-domicilio').textContent = fiscales.domicilio_fiscal;
    document.getElementById('lista-datos-fiscales').hidden = false;
}

cargarPerfil();   // la ejecuta apenas carga la página

const boton = document.getElementById('boton-cerrar-sesion');
boton.addEventListener('click', cerrarSesion);