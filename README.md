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
- **Mapa**: escala logarítmica común a los ocho años. En «Comparar», razón sábado y domingo / lunes a viernes a la misma hora. En «Relieve 3D», altura lineal a los viajes. En «Flujos», arcos de origen (claro) a destino (oscuro), con grosor por viajes al día y taxis animados (sin animación si el sistema pide reducir movimiento).
- **Gráfico**: viajes por hora, velocidad por hora o la madrugada del fin de semana en ocho eneros. Un clic cambia la hora o el año.
- **Fondo**: el agua del mapa y el fondo de la historia se oscurecen entre las 20:00 y las 08:00. No cambia la codificación de color de los datos.
- **Sonido** (necesita un clic): lunes a viernes a la izquierda (sine) y fin de semana a la derecha (triangle). Ritmo = viajes (0,5–5 pulsos/s, relativo al máximo de ambas curvas de la selección). Tono = velocidad mediana en una escala pentatónica (10–28 km/h). En «Comparar» suenan ambas voces; en los otros modos, solo la del tipo de día elegido. Cambiar de pestaña pausa sonido y reproducción.

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
- **Tarifa**: mediana de `total_amount` en esos mismos viajes, en dólares corrientes.

Enero de 2026 tiene **3.724.889 filas**; enero de 2019, 7.696.617. Los conteos no filtran tarifas ni distancias: cuentan registros, no personas ni demanda insatisfecha. No incluye otros servicios. Lunes–viernes incluye feriados. No se aplican conversiones UTC a las horas locales del archivo.

La escala del mapa se fija con el máximo de todas las zonas, horas, filtros y años (1.100 viajes/día, redondeado a centenas), para comparar años con los mismos colores y alturas. Las medias incluyen días sin eventos. Por eso no se pueden sumar directamente las medias de los dos tipos de día: hay que ponderarlas por la cantidad de días de cada tipo.

## Verificar

```sh
npm test
npm run build
```

`src/data.test.ts` comprueba, para cada año, el calendario, la conservación de conteos, la media ponderada, la selección por zona, las curvas de `years.json` y el límite de la escala común. `src/story.test.ts` recalcula cada cifra y zona que cita la historia, y prueba el arco, la nota y la curva de noche.

## Dependencias externas y límites

React, TypeScript, Vite, MapLibre GL JS, Plotly.js y Tone.js. El mapa usa geometrías locales sin tokens ni servidor de mapas; no muestra calles. Las fuentes se descargan de Google Fonts, con alternativas del sistema sin conexión. La primera descarga incluye bibliotecas de gráficos grandes y cerca de 1,3 MB de datos por año elegido. El mapa requiere WebGL; el sonido requiere Web Audio y autorización mediante clic.
