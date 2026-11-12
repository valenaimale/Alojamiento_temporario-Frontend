// Enlaces del menú según el rol del usuario logueado.
// Para sumar una página al menú de un rol, se agrega acá.
const ENLACES_HUESPED = [
    { texto: 'Explorar', url: '../homes/index-huesped.html' },
    { texto: 'Mis reservas', url: '../reservas/mis-reservas.html' },
];
// La ayuda de los pagos (vistas/ayuda/pagos.html), abierta en la sección de cada rol. El operador no paga ni cobra.
const AYUDA_PAGOS = {
    huesped: { texto: 'Cómo pagar', url: '../ayuda/pagos.html#huesped' },
    propietario: { texto: 'Pagos y cobros', url: '../ayuda/pagos.html#propietario' },
    administrador: { texto: 'Pagos y cobros', url: '../ayuda/pagos.html#administrador' },
};
const MENU = {
    huesped: [...ENLACES_HUESPED, AYUDA_PAGOS.huesped],
    // el propietario ve lo mismo que el huésped y además "Mis alojamientos"
    propietario: [
        ...ENLACES_HUESPED,
        { texto: 'Mis alojamientos', url: '../homes/index-propietario.html' },
        { texto: 'Liquidaciones', url: '../liquidaciones/mis-liquidaciones.html' },
        AYUDA_PAGOS.propietario,
    ],
    operador: [{ texto: 'Agenda', url: '../homes/index-operador.html' }],
    administrador: [
        { texto: 'Alojamientos a cargo', url: '../homes/index-administrador.html' },
        { texto: 'Mis comisiones', url: '../liquidaciones/comisiones.html' },
        AYUDA_PAGOS.administrador,
    ],
    backoffice: [{ texto: 'Usuarios', url: '../homes/index-backoffice.html' }],   // la página la crea la Tarea 2
};

// Arma el menú dentro del <nav id="menu"> de la página.
function armarMenu(rol) {
    const lista = document.createElement('ul');
    for (const enlace of MENU[rol]) {
        const a = document.createElement('a');
        a.href = enlace.url;
        a.textContent = enlace.texto;
        const ruta = window.location.pathname;
        const enAlojamiento = ruta.includes('/unidades/') && enlace.url.includes(rol === 'administrador' ? 'index-administrador' : 'index-propietario');
        const explorando = ruta.includes('/alojamientos/') && enlace.url.includes('index-huesped');
        // el comprobante de una liquidación marca la sección del rol que lo abre (cada rol tiene una sola)
        const liquidando = ruta.includes('/liquidaciones/') && enlace.url.includes('/liquidaciones/');
        if (a.pathname === ruta || enAlojamiento || explorando || liquidando) {
            a.setAttribute('aria-current', 'page');
        }
        const item = document.createElement('li');
        item.appendChild(a);
        lista.appendChild(item);
    }
    document.getElementById('menu').replaceChildren(lista);
}
