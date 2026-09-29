# El pulso de Nueva York

V1 del grupo 16: visualización de taxis amarillos de enero de 2019 a 2026, con datos oficiales NYC TLC.

## Abrir

Requiere Node 22.18+ y npm. Los datos procesados están incluidos; no se necesita Python para abrir la web.

```sh
npm ci
npm run dev
```

Abrir la URL que indica Vite. `npm run build` genera `dist/`. `npm run preview` sirve esa versión. Para GitHub Pages, publicar **el contenido de dist**, no los archivos de código. `base: './'` permite servir desde la subcarpeta del repositorio. No se ha creado repositorio, commit ni despliegue.

## Explorar

- El mapa muestra viajes por zona, hora y día promedio.
- Año: enero de 2019 a 2026 (selector o clic en el gráfico «Ocho eneros»). Cada año se carga al elegirlo.
- Tipo de día: todos (31) o lunes–viernes y sábado–domingo según el calendario de cada enero.
- Vista 3D: la altura es lineal a los viajes; el color mantiene la escala del modo elegido.
- Salidas y llegadas usan su propia fecha y hora local.
- El selector horario o Reproducir día recorre las 24 horas.
- Un clic en el mapa, el ranking o el selector de zona actualiza el detalle y el gráfico.
- El gráfico siempre compara ambos tipos de día para la zona seleccionada. El filtro de día afecta mapa, cifra, ranking y sonido.
- Mapa: **Cantidad** (escala logarítmica fija) o **Fin de semana vs semana** (razón sábado–domingo / lunes–viernes a la misma hora; desactiva el filtro de día).
- Pasar el puntero sobre una zona muestra su valor. Un clic en el gráfico horario cambia la hora.
- Activar sonido necesita un clic. Dos voces: lunes–viernes a la izquierda (sine, grave) y sábado–domingo a la derecha (triangle, aguda). Más viajes, más pulsos (0,5–5 Hz), relativo al máximo de ambas curvas de la zona seleccionada o de la ciudad. Volumen constante. Cero actividad produce silencio. Cambiar de pestaña pausa reproducción y sonido.

## Datos y reproducibilidad

Fuente: https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page

Archivos: `https://d37ci6vzurychx.cloudfront.net/trip-data/yellow_tripdata_YYYY-01.parquet`, de 2019 a 2026.

Geometrías: https://d37ci6vzurychx.cloudfront.net/misc/taxi_zones.zip

Para regenerar (requiere `uv` y conexión; descarga unos 500 MB):

```sh
npm run data
```

El script usa DuckDB y GeoPandas. Guarda originales en `data/raw/` (excluido de Git), simplifica geometrías en WGS84 y genera `public/data/trips-YYYY.json`, `years.json` y `zones.geojson`. Cada JSON anual incluye SHA-256 y conteos de exclusión. `years.json` tiene las curvas horarias de la ciudad y el máximo por zona de todos los años.

Enero de 2026 tiene **3.724.889 filas**; enero de 2019, 7.696.617. No se filtran tarifas o distancias: la métrica cuenta registros, no personas ni demanda insatisfecha. No incluye otros servicios. Lunes–viernes incluye feriados. No se aplican conversiones UTC a las horas locales del archivo.

La escala del mapa se fija con el máximo de todas las zonas, horas, filtros y años (1.100 viajes/día, redondeado a centenas), para comparar años con los mismos colores y alturas. Las medias incluyen días sin eventos. Por eso no se pueden sumar directamente las medias de los dos tipos de día: hay que ponderarlas por la cantidad de días de cada tipo.

## Verificar

```sh
npm test
npm run build
```

Los tests comprueban, para cada año, el calendario, la conservación de conteos, la media ponderada, la selección por zona, las curvas de `years.json` y el límite de la escala común.

## Dependencias externas y límites

React, TypeScript, Vite, MapLibre GL JS, Plotly.js y Tone.js. El mapa usa geometrías locales sin tokens ni servidor de mapas; no muestra calles. Las fuentes se descargan de Google Fonts, con alternativas del sistema sin conexión. La primera descarga incluye bibliotecas de gráficos grandes. El mapa requiere WebGL; el sonido requiere Web Audio y autorización mediante clic.
