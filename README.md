# El pulso de Nueva York

V1 del grupo 16: visualización de taxis amarillos de enero de 2019 a 2026, con datos oficiales NYC TLC.

## Abrir

Requiere Node 22.18+ y npm. Los datos procesados están incluidos; no se necesita Python para abrir la web.

```sh
npm ci
npm run dev
```

Abrir la URL que indica Vite. `npm run build` genera `dist/` y `npm run preview` sirve esa versión. Cada push a `main` publica en GitHub Pages con `.github/workflows/pages.yml`.

## Recorrido

La página tiene dos partes que comparten el mismo mapa fijo:

1. **Historia** (8 escenas al hacer scroll). Cada escena fija año, hora, días, cámara, capas y gráfico. Las cifras del texto se verifican en `src/story.test.ts`. Tocar el mapa o un gráfico durante la historia salta a explorar desde esa misma vista.
2. **Explora tú**: año (2019–2026), días (lunes a viernes, fin de semana o comparar), salidas o llegadas, hora con reproducción del día, capas (flujos o relieve 3D), búsqueda de zona y lista de zonas o destinos.

- **Taxímetro** (arriba a la izquierda): hora, viajes de esa hora (promedio por día), velocidad mediana y botón de sonido.
- **Mapa**: densidad en viajes por km², escala logarítmica común a los ocho años (0,1 a 1.000; cada marca ×10), en violeta. En «Comparar», sábado y domingo dividido por lunes a viernes a la misma hora (azul–blanco–naranjo). En «Flujos», los 40 pares mayores entre zonas distintas (o 6 por zona elegida), de origen (claro) a destino (oscuro), con grosor y taxis animados según los viajes, y anillos para los viajes dentro de la misma zona. «Relieve 3D» solo existe al explorar, con advertencia. Para acercar: botones, doble clic, dos dedos o Ctrl/⌘ + rueda; elegir una zona acerca la cámara.
- **Gráfico**: viajes por hora, velocidad por hora o la madrugada del fin de semana en ocho eneros. Las horas van de mediodía a mediodía para no partir la noche. Etiquetas directas sobre cada curva. Un clic cambia la hora o el año.
- **Fondo**: el fondo de la historia se oscurece entre las 20:00 y las 08:00. El agua del mapa no cambia, para no alterar la lectura de los colores.
- **Sonido** (necesita un clic, `src/sound.ts`): cada sonido es un auto que pasa. Pasan más autos con más viajes (0,5–5 por segundo, relativo al máximo de ambas curvas de la selección); el motor suena más agudo y pasa más rápido con más velocidad; bajo 15 km/h aparecen bocinas. Lunes a viernes a la izquierda, fin de semana a la derecha; en «Comparar» suenan ambos. En la historia, una voz (Web Speech API) lee la hora y el título de cada escena. Cambiar de pestaña pausa sonido y reproducción.

## Datos y reproducibilidad

Fuente: https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page

Archivos: `https://d37ci6vzurychx.cloudfront.net/trip-data/yellow_tripdata_YYYY-01.parquet`, de 2019 a 2026.

Geometrías: https://d37ci6vzurychx.cloudfront.net/misc/taxi_zones.zip

Para regenerar (requiere `uv` y conexión; descarga unos 500 MB):

```sh
npm run data
```

El script usa DuckDB y GeoPandas. Guarda originales en `data/raw/` (excluido de Git), simplifica geometrías en WGS84 y genera `public/data/trips-YYYY.json`, `years.json` y `zones.geojson`. Cada JSON anual incluye conteos por zona y hora, velocidades medianas, flujos origen→destino, SHA-256 y conteos de exclusión. `years.json` tiene las curvas horarias y de velocidad de la ciudad, la tarifa mediana y el máximo por zona de todos los años. `zones.geojson` incluye un punto interior por zona para dibujar los flujos.

- **Velocidad**: distancia / duración en viajes de 1 min a 3 h, 0,1 a 50 millas y 1 a 70 mph; mediana por hora de salida, en km/h. Una zona necesita 10 viajes en esa hora del mes; si no, la página usa la de la ciudad.
- **Flujos**: pares de zonas distintas por hora de salida con al menos medio viaje al día. Se guardan los 6 destinos y 6 orígenes principales por zona y los 40 pares mayores de la ciudad.
- **Tarifa**: mediana de `total_amount` en esos mismos viajes. `fareReal` la lleva a dólares de enero de 2026 con el IPC del área de Nueva York (BLS, serie CUURS12ASA0, valores de enero en el script).
- **Área**: `zones.geojson` incluye `km2` (calculado en EPSG:2263) para la densidad, y `years.json` el máximo `densityMax`.
- **Viajes dentro de la zona**: `stays` guarda los pares con origen y destino en la misma zona (al menos medio viaje al día). Los empates del top de flujos se ordenan por zona para que cada corrida dé el mismo resultado.

Enero de 2026 tiene **3.724.889 filas**; enero de 2019, 7.696.617. Los conteos no filtran tarifas ni distancias: cuentan registros, no personas ni demanda insatisfecha. No incluye otros servicios. Lunes–viernes incluye feriados. No se aplican conversiones UTC a las horas locales del archivo.

La escala del mapa se fija con el máximo de todas las zonas, horas, filtros y años (1.100 viajes/día, redondeado a centenas), para comparar años con los mismos colores y alturas. Las medias incluyen días sin eventos. Por eso no se pueden sumar directamente las medias de los dos tipos de día: hay que ponderarlas por la cantidad de días de cada tipo.

## Verificar

```sh
npm test
npm run build
```

`src/data.test.ts` comprueba, para cada año, el calendario, la conservación de conteos, la media ponderada, la selección por zona, las curvas de `years.json` y el límite de la escala común. `src/story.test.ts` recalcula cada cifra y zona que cita la historia (incluida la tarifa real y los viajes dentro de East Village), comprueba que ninguna escena use 3D y prueba el arco, el sonido de autos, el orden de mediodía a mediodía y la curva de noche.

## Dependencias externas y límites

React, TypeScript, Vite, MapLibre GL JS, Plotly.js y Tone.js. El mapa usa geometrías locales sin tokens ni servidor de mapas; no muestra calles. Las fuentes se descargan de Google Fonts, con alternativas del sistema sin conexión. La primera descarga incluye bibliotecas de gráficos grandes y cerca de 1,3 MB de datos por año elegido. El mapa requiere WebGL; el sonido requiere Web Audio y autorización mediante clic.
