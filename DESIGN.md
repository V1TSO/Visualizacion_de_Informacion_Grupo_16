# V1: decisiones iniciales

Pregunta: ¿dónde y a qué hora se concentran los viajes registrados de taxis amarillos, y qué cambia entre lunes–viernes y sábado–domingo?

Mensaje: el fin de semana, Nueva York no madruga: trasnocha. Hay casi los mismos viajes por día, pero entre 00 y 05 h hay 3× más salidas que de lunes a viernes, y entre 06 y 10 h, la mitad.

Contexto histórico: ocho eneros (2019–2026) repiten el patrón. La noche del fin de semana tiene de 2,7× a 4,8× más salidas; solo en 2021 (pandemia) baja a 1,5×. Los taxis amarillos hacen hoy la mitad de los viajes diarios que en 2019.

Audiencia: personas interesadas en patrones de movilidad urbana. Alcance: enero de 2019 a 2026 y taxis amarillos. No generalizar a toda la movilidad de Nueva York.

- Posición geográfica para localizar patrones; color secuencial para cantidad absoluta por zona. Las zonas tienen áreas diferentes: esto no es densidad por km².
- Escala logarítmica fija (1, 5, 25, 125, 1.100), común a todos los años. Con escala lineal, la zona mediana tiene 0,76 % del máximo y queda casi blanca; Manhattan concentra el 85,5 % de las salidas. La escala log muestra diferencias fuera de Manhattan y mantiene la misma escala en todas las horas.
- Modo "Fin de semana vs semana": razón entre promedios diarios a la misma hora, con paleta divergente en los colores de las curvas. Responde la pregunta directamente, sin comparar de memoria dos filtros. Zonas con menos de 1 viaje/día en gris; el ranking de este modo exige 10+ viajes/día para evitar razones ruidosas.
- Mapa como vista inicial; filtros para hora y tipo de día; detalle al pasar el puntero (tooltip) o al seleccionar una zona. El selector y el ranking permiten explorar sin depender del puntero sobre el mapa. Un clic en el gráfico horario cambia la hora.
- Gráfico «Ocho eneros»: barras de la razón noche fin de semana / noche entre semana por año, con la línea de igualdad y la pandemia anotada. Usa el mismo enero para evitar la estacionalidad. Un clic cambia el año de toda la página.
- Vista 3D opcional: la altura es lineal a los viajes (como Population Mountains) y el color mantiene la escala del modo. En el modo comparación, esto combina dos variables: la altura muestra cuánto se viaja y el color muestra cuándo. El 2D es la vista por defecto, porque la perspectiva y la oclusión distorsionan la comparación de alturas.
- Dos curvas con color y trazo distintos (la banda «Noche» marca las 00–05 h) comparan tipos de día sobre los mismos ejes, desde cero.
- Promedios por día para no confundir más fechas con más intensidad.
- Sonido estéreo: lunes–viernes a la izquierda (sine, grave), sábado–domingo a la derecha (triangle, aguda). El ritmo codifica la cantidad (0,5–5 pulsos/s, relativo al máximo de ambas curvas); el volumen es constante. Sigue a la zona seleccionada o a toda la ciudad. Así se escucha la comparación, como pide la pauta (tono, ritmo, timbre). Activación voluntaria y control de pausa.
- Paleta: papel frío #f7f9f9, agua #dfeaf0, tinta azul #173c50, amarillo taxi #f6bd16; escala secuencial amarillo–marrón; divergente azul #245978 – naranjo #b65d23. Barlow Condensed evoca señalética urbana; DM Sans prioriza legibilidad de controles.

Alternativas descartadas:
- Dibujar millones de viajes individuales: sobreposición y costo.
- Colorear cada hora con un máximo distinto: impide comparar magnitudes.
- Escala por cuantiles: oculta magnitudes reales y la leyenda es más difícil de leer.
- Diferencia absoluta de viajes en el modo comparación: la dominan las zonas grandes; la razón compara la forma.
- Mapa de balance salidas − llegadas: queda para una iteración futura.
- Todos los meses de 2025: mezclaría estacionalidad con el efecto del tipo de día; se eligió comparar el mismo mes entre años.
- 3D como vista por defecto: oculta zonas detrás de las torres (JFK, Midtown).

## Preguntas para R1

1. ¿Se entiende que el color representa viajes por zona y no densidad por superficie?
2. ¿El mapa de razón fin de semana / semana se lee sin explicación? ¿La vista 3D aporta o distrae frente al 2D?
3. ¿Las dos voces estéreo ayudan a comparar los tipos de día, o distraen?

## Registro pendiente

Completar después de la revisión: fecha, feedback recibido, cambios adoptados o descartados y razones. Añadir capturas, video con sonido y referencia al commit real. Todavía no hay revisión docente ni evaluación con usuarios registrada.
