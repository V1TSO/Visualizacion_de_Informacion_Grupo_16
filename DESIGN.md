# V1: decisiones iniciales

Pregunta: ¿qué cambia en los viajes de taxis amarillos entre lunes a viernes y el fin de semana, dónde y a qué hora?

Mensaje: el fin de semana, Nueva York no madruga: trasnocha. En enero de 2026, a las 08:00 del fin de semana hay un 57 % menos de viajes que un día de semana; a la 01:00, 3,3 veces más. La noche se concentra en East Village, West Village y el Lower East Side, vuelve a casa cerca (Murray Hill, Kips Bay, Gramercy) y es rápida: 27,4 km/h a las 05:00 contra 12,5 km/h a las 11:00 de un día de semana.

Contexto histórico: ocho eneros (2019–2026) repiten el patrón. Entre 00:00 y 05:00, el fin de semana tiene de 2,6 a 4,8 veces los viajes de un día de semana; solo en 2021 (pandemia) baja a 1,5. Hoy hay la mitad de viajes que en 2019 y el viaje mediano cuesta el doble (23,09 contra 11,30 dólares).

Audiencia: personas interesadas en la vida urbana, sin formación en datos. Alcance: enero de 2019 a 2026 y taxis amarillos. No generalizar a toda la movilidad de Nueva York.

## Estructura

- Martini glass: primero una historia guiada de 8 escenas (explicativa), después «Explora tú» (exploratoria) con el mismo mapa. Una persona que prueba la página por unos segundos recibe el mensaje sin tocar controles.
- Cada escena se marca con su día y hora («Sábado y domingo, 01:00»), no con números: la secuencia es el reloj de la ciudad.
- Tocar el mapa o un gráfico durante la historia salta a explorar desde esa vista, sin perder el contexto.
- Portada: las dos curvas horarias de 2026 dibujadas como horizonte. El dato es la imagen de entrada.

## Codificación

- Posición geográfica para localizar patrones; color secuencial para cantidad absoluta por zona. Las zonas tienen áreas distintas: no es densidad por km².
- Escala logarítmica fija (1, 5, 25, 125, 1.100), común a todas las horas y a los ocho años. Con escala lineal, la zona mediana tiene 0,76 % del máximo y queda casi blanca; Manhattan concentra el 85,5 % de las salidas.
- «Comparar»: razón entre promedios diarios de sábado y domingo y de lunes a viernes a la misma hora; paleta divergente con los colores de las curvas (azul lun–vie, naranjo fin de semana). Zonas con menos de 1 viaje al día en gris.
- Relieve 3D (escena 4 y capa opcional): altura lineal a los viajes y color por razón. Combina cuánto se viaja con cuándo. No es la vista por defecto porque la perspectiva y la oclusión distorsionan la comparación de alturas.
- Flujos: arcos entre puntos interiores de las zonas, curvados a la derecha del sentido del viaje para que A→B y B→A no se tapen. Grosor = raíz de los viajes al día. La dirección se lee con un degradado de claro (origen) a oscuro (destino) y con taxis animados. Con flujos, el mapa pasa a gris neutro para que el movimiento sea lo único que compite por la atención.
- Etiquetas en el mapa solo para las zonas que cita la escena, o la zona elegida y sus tres flujos principales.
- Taxímetro: hora, viajes de esa hora y velocidad mediana, en un panel que evoca el taxímetro del taxi. Es el único elemento llamativo del escenario.
- La hora oscurece el agua del mapa y el fondo de la historia (de 20:00 a 08:00). Refuerza día y noche sin cambiar la escala de color de los datos.
- Gráfico del escenario: viajes por hora, velocidad por hora u ocho eneros, según la escena. En viajes se atenúa el tipo de día que no se ve en el mapa; en velocidad se muestran ambos porque la escena los compara.
- Promedios por día de cada tipo para no confundir más fechas con más intensidad.
- Paleta: papel #f4f6f5, tinta #173c50, noche #152433, amarillo taxi #f6bd16; secuencial amarillo–marrón; divergente #245978 – #b65d23. Barlow Condensed (señalética y taxímetro) y DM Sans (texto y controles).

## Sonido

- Dos voces en estéreo: lunes a viernes a la izquierda (sine), fin de semana a la derecha (triangle). En «Comparar» suenan ambas; en los otros modos, solo la que se ve.
- Ritmo = cantidad de viajes (0,5–5 pulsos por segundo, relativo al máximo de ambas curvas de la selección).
- Tono = velocidad mediana, en una escala pentatónica de 10 a 28 km/h. La noche rápida suena más aguda; la hora punta, más grave. Así el sonido agrega una variable que el mapa no muestra, como pide la pauta (tono, ritmo y timbre, no solo volumen).
- Volumen constante. Cero viajes produce silencio: en 2021 el silencio también es un dato.

## Alternativas descartadas

- Dashboard con todos los controles visibles desde el inicio: el mensaje dependía de hacer clic en lo correcto.
- Selector de «todos los días» y ranking separado: no ayudaban a responder la pregunta. Se reemplazaron por tres modos de días y una lista contextual (zonas, razones o destinos).
- Menú desplegable de 263 zonas: se reemplazó por búsqueda con autocompletado y clic en el mapa.
- Dibujar millones de viajes individuales: sobreposición y costo.
- Colorear cada hora o año con un máximo distinto: impide comparar magnitudes.
- Escala por cuantiles: oculta magnitudes reales.
- Diferencia absoluta en «Comparar»: la dominan las zonas grandes; la razón compara la forma.
- Todos los meses de 2025: mezclaría estacionalidad con el efecto del tipo de día.
- Fondo oscuro también bajo las zonas: invertiría la lectura de la escala (lo claro parecería más).
- Mapa de balance salidas − llegadas: queda para una iteración futura.

## Preguntas para R1

1. ¿La historia guiada se entiende sin explicación, o las 8 escenas son demasiadas?
2. ¿Los flujos se leen con el degradado y los taxis animados, o hace falta otra marca de dirección?
3. ¿El tono por velocidad se distingue del ritmo por cantidad cuando suenan las dos voces?

## Registro pendiente

Completar después de la revisión: fecha, feedback recibido, cambios adoptados o descartados y razones. Añadir capturas, video con sonido y referencia al commit real. Todavía no hay revisión docente ni evaluación con usuarios registrada.
