// Enlaces del menú según el rol del usuario logueado.
// Para sumar una página al menú de un rol, se agrega acá.
const ENLACES_HUESPED = [
    { texto: 'Inicio', url: '../homes/index-huesped.html' },
    { texto: 'Alojamientos', url: '../alojamientos/listado.html' },
];
const MENU = {
    huesped: ENLACES_HUESPED,
    // el propietario ve lo mismo que el huésped y además "Mis propiedades"
    propietario: [...ENLACES_HUESPED, { texto: 'Mis propiedades', url: '../homes/index-propietario.html' }],
    operador: [{ texto: 'Agenda', url: '../homes/index-operador.html' }],
    administrador: [{ texto: 'Inicio', url: '../homes/index-administrador.html' }],
};

// Arma el menú dentro del <nav id="menu"> de la página.
function armarMenu(rol) {
    const lista = document.createElement('ul');
    for (const enlace of MENU[rol]) {
        const a = document.createElement('a');
        a.href = enlace.url;
        a.textContent = enlace.texto;
        if (a.pathname === window.location.pathname) {   // marca la página en la que está el usuario
            a.setAttribute('aria-current', 'page');
        }
        const item = document.createElement('li');
        item.appendChild(a);
        lista.appendChild(item);
    }
    document.getElementById('menu').appendChild(lista);
}
