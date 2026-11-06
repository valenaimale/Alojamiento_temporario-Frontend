// Perfil del usuario logueado: sus datos y, si es propietario o administrador, sus datos fiscales, su cuenta
// bancaria y su billetera de cobro (que puede cargar o cambiar desde acá).

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
    if (usuario.rol === 'propietario' || usuario.rol === 'administrador') {   // los dos tienen datos fiscales y cuenta bancaria
        cargarDatosFiscales();
    }
}

// Pide al back los datos fiscales y bancarios (propietario o administrador) y los muestra en sus dos secciones.
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

    // la cuenta bancaria se carga siempre (va primero porque el bloque de abajo puede cortar con return)
    document.getElementById('banco-cbu').textContent = fiscales.cbu;
    document.getElementById('banco-alias').textContent = fiscales.alias ?? 'Sin alias';   // el alias es opcional
    document.getElementById('banco-titular').textContent = fiscales.titular_cuenta;
    document.getElementById('seccion-cuenta-bancaria').hidden = false;
    mostrarBilletera(fiscales.billetera);

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

// Muestra la billetera de cobro. Los que se registraron antes de que se pidiera la tienen en null: se les avisa que la carguen.
function mostrarBilletera(billetera) {
    document.getElementById('billetera-direccion').textContent = billetera ?? 'Sin cargar';
    document.getElementById('aviso-sin-billetera').hidden = billetera !== null;
    document.getElementById('seccion-billetera').hidden = false;
}

// Guarda la billetera nueva en el back (POST /datos-fiscales/billetera) y muestra cómo quedó.
async function guardarBilletera(evento) {
    evento.preventDefault();   // la manejamos nosotros, sin recargar la página
    const mensaje = document.getElementById('mensaje-billetera');
    mensaje.textContent = '';
    const datos = Object.fromEntries(new FormData(evento.target));   // {billetera}

    let respuesta;
    let resultado;
    try {
        respuesta = await fetch(URL_BACK + '/datos-fiscales/billetera', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos),
        });
        resultado = await respuesta.json();
    } catch (error) {   // el back no respondió: lo escrito queda en el campo para volver a intentar
        console.error('No se pudo conectar con el back:', error);
        mensaje.textContent = MENSAJE_SIN_CONEXION;
        return;
    }
    if (!respuesta.ok) {
        mensaje.textContent = resultado.error;
        return;
    }

    mostrarBilletera(resultado.datos_fiscales.billetera);   // el back la devuelve en minúsculas
    evento.target.reset();
    mensaje.textContent = resultado.ok;
}

cargarPerfil();   // la ejecuta apenas carga la página
document.getElementById('form-billetera').addEventListener('submit', guardarBilletera);

const boton = document.getElementById('boton-cerrar-sesion');
boton.addEventListener('click', cerrarSesion);