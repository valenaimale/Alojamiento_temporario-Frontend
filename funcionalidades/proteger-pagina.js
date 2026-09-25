// Se usa en los homes de cada rol. Lee el rol permitido del atributo data-rol del body
// (por ejemplo <body data-rol="propietario" hidden>) y verifica la sesión con el back.
protegerPagina(document.body.dataset.rol);
