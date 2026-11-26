// Velocidad mediana de los taxis amarillos de Nueva York por hora de salida, en km/h, enero de 2026
// (public/data/years.json: distancia / duración en viajes de 1 minuto a 3 horas, toda la ciudad).
// [0]: lunes a viernes. [1]: fin de semana. La usan el celular del taxi (arduino.html) y la pantalla (index.html).
window.VELOCIDAD = [
  [21.6, 21.5, 22.1, 23.3, 25.2, 24.8, 21.1, 16.9, 14.2, 13.4, 13.0, 12.5, 12.7, 12.9, 12.8, 12.5, 13.0, 12.9, 13.5, 14.6, 16.0, 16.7, 17.5, 19.2],
  [18.3, 19.3, 20.3, 21.7, 23.5, 27.4, 26.7, 24.4, 21.3, 19.5, 17.9, 16.4, 15.4, 14.7, 14.8, 14.6, 14.3, 13.9, 14.0, 14.5, 15.8, 16.6, 17.0, 18.2],
];
window.DIAS = ['Lunes a viernes', 'Fin de semana'];
