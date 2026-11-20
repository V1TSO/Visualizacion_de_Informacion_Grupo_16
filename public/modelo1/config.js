// Protobject (https://framework.protobject.com): une la pantalla del computador (index.html) con el
// celular que lleva enchufado el Arduino (arduino.html). El celular abre su página escaneando el QR
// que muestra la pantalla. Si app.protobject.com no carga, la pantalla sigue como simulación.
// p.js declara Protobject con const: no queda en window, por eso se usa typeof.
if (typeof Protobject !== 'undefined') {
  Protobject.setProduction(true); // agrega ?ptjuid=… a la dirección: cada sesión tiene su propio canal
  Protobject.initialize([
    { name: 'Pantalla', page: 'index.html', main: true },
    // debug: 'remote' manda los console.log del celular a la consola del computador.
    { name: 'Celular con Arduino', page: 'arduino.html', debug: 'remote' },
  ]);
}
