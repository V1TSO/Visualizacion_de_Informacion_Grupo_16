# Registro de diseño

Sigue la plantilla de la E1 (estado: V4): contexto general y, en orden, cada versión con la revisión que la siguió. Los campos que dependen de apuntes del grupo dicen «[completar]».

Orden real, distinto del de la plantilla: V1 → R1 → R2 (sobre la V1) → V2 → R3 (sobre la V2) → V3 → V4. La R2 llegó antes de cerrar la V2, y la R3 revisó la V2 porque la V3 todavía no existía. Lo dejamos así en vez de reordenarlo.

## Contexto general

Pregunta: ¿qué cambia en los viajes de taxis amarillos entre lunes a viernes y el fin de semana, dónde y a qué hora?

Mensaje (V2): el fin de semana, Nueva York no madruga: trasnocha. En enero de 2026, a las 08:00 de un día de semana empiezan 5.719 viajes y muchos van a Midtown; a esa hora del fin de semana hay un 57 % menos. A las 13:00 del fin de semana llegan el doble de viajes a Times Square, East Village y West Village. A la 01:00 hay 3,3 veces más viajes que un día de semana, sobre todo desde East Village, y terminan cerca (Murray Hill, Kips Bay, Gramercy). La madrugada es rápida: 27,4 km/h a las 05:00 contra 12,5 km/h a las 11:00 de un día de semana. Los ocho eneros de 2019 a 2026 repiten el patrón: de madrugada, el fin de semana tiene entre 1,5 (2021, en pandemia) y 4,8 veces los viajes de lunes a viernes.

Audiencia: personas interesadas en la vida urbana, sin formación en datos. Alcance: enero de 2019 a 2026 y taxis amarillos. No generalizar a toda la movilidad de Nueva York.

Datos: registros oficiales de la NYC TLC, procesados con DuckDB y GeoPandas. Origen, filtros y transformaciones en `README.md`, sección «Datos y reproducibilidad».

## V1: la idea completa

28 de septiembre de 2026 · tag `v1` (commit `10cc6c2`).

Mensaje en V1: el mismo contraste, con tres afirmaciones que V2 corrigió: la noche «vuelve a casa cerca», «solo la pandemia apagó la noche» y «el viaje mediano cuesta el doble» (23,09 contra 11,30 dólares, sin descontar inflación).

### Estructura

- Martini glass: primero una historia guiada de 8 escenas (explicativa), después «Explora tú» (exploratoria) con el mismo mapa. Una persona que prueba la página por unos segundos recibe el mensaje sin tocar controles.
- Cada escena se marca con su día y hora («Sábado y domingo, 01:00»), no con números: la secuencia es el reloj de la ciudad.
- Tocar el mapa o un gráfico durante la historia salta a explorar desde esa vista, sin perder el contexto.
- Portada: las dos curvas horarias de 2026 dibujadas como horizonte. El dato es la imagen de entrada.

### Codificación

- Posición geográfica para localizar patrones; color secuencial para cantidad absoluta por zona. Las zonas tienen áreas distintas: no es densidad por km².
- Escala logarítmica fija (1, 5, 25, 125, 1.100), común a todas las horas y a los ocho años. Con escala lineal, la zona mediana tiene 0,76 % del máximo y queda casi blanca; Manhattan concentra el 85,5 % de las salidas.
- «Comparar»: razón entre promedios diarios de sábado y domingo y de lunes a viernes a la misma hora; paleta divergente con los colores de las curvas (azul lun–vie, naranjo fin de semana). Zonas con menos de 1 viaje al día en gris.
- Relieve 3D (una escena y capa opcional): altura lineal a los viajes y color por razón. Combina cuánto se viaja con cuándo. No es la vista por defecto porque la perspectiva y la oclusión distorsionan la comparación de alturas.
- Flujos: arcos entre puntos interiores de las zonas, curvados a la derecha del sentido del viaje para que A→B y B→A no se tapen. Grosor = raíz de los viajes al día. La dirección se lee con un degradado de claro (origen) a oscuro (destino) y con taxis animados. Con flujos, el mapa pasa a gris neutro para que el movimiento sea lo único que compite por la atención.
- Etiquetas en el mapa solo para las zonas que cita la escena, o la zona elegida y sus tres flujos principales.
- Taxímetro: hora, viajes de esa hora y velocidad mediana, en un panel que evoca el taxímetro del taxi. Es el único elemento llamativo del escenario.
- La hora oscurece el agua del mapa y el fondo de la historia (de 20:00 a 08:00). Refuerza día y noche sin cambiar la escala de color de los datos.
- Gráfico del escenario: viajes por hora, velocidad por hora u ocho eneros, según la escena. En viajes se atenúa el tipo de día que no se ve en el mapa; en velocidad se muestran ambos porque la escena los compara.
- Promedios por día de cada tipo para no confundir más fechas con más intensidad.
- Paleta: papel #f4f6f5, tinta #173c50, noche #152433, amarillo taxi #f6bd16; secuencial amarillo–marrón; divergente #245978 – #b65d23. Barlow Condensed (señalética y taxímetro) y DM Sans (texto y controles).

### Sonido

- Dos voces en estéreo: lunes a viernes a la izquierda (sine), fin de semana a la derecha (triangle). En «Comparar» suenan ambas; en los otros modos, solo la que se ve.
- Ritmo = cantidad de viajes (0,5–5 pulsos por segundo, relativo al máximo de ambas curvas de la selección).
- Tono = velocidad mediana, en una escala pentatónica de 10 a 28 km/h. La noche rápida suena más aguda; la hora punta, más grave. Así el sonido agrega una variable que el mapa no muestra, como pide la pauta (tono, ritmo y timbre, no solo volumen).
- Volumen constante. Cero viajes produce silencio: en 2021 el silencio también es un dato.

### Qué se descartó

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

## R1: revisión con el equipo docente

Fecha: [completar; según el anuncio de la R3, mismo horario que hoy, probablemente 29 de septiembre de 2026].

Preguntas que llevamos:
1. ¿La historia guiada se entiende sin explicación, o las 8 escenas son demasiadas?
2. ¿Los flujos se leen con el degradado y los taxis animados, o hace falta otra marca de dirección?
3. ¿El tono por velocidad se distingue del ritmo por cantidad cuando suenan las dos voces?

Síntesis y decisiones: [completar con los apuntes del grupo: qué se discutió, qué adoptamos, qué descartamos y por qué].

Trabajo paralelo: la rama `feat/course-principles` (PR #1, borrador, 29 de septiembre) tiene una autocrítica con los principios del curso que no se integró a `main`. V2 toma de ella las correcciones de texto y la prueba de la escala violeta. Quedan sin integrar: sacar el 3D de la historia, densidad por km², sonido de autos, eje de mediodía a mediodía y zoom con Ctrl + rueda.

## R2: revisión entre pares

8 de octubre de 2026. Presentamos la V1: la V2 aún no estaba cerrada.

Evaluamos al grupo 2: estadios de fútbol con mayor capacidad y dónde están. Lo que les dijimos:
- El mensaje es claro desde el inicio y la imagen responde la consigna.
- Falta una historia que guíe.
- El tamaño de los círculos compara bien.
- El filtro de confederación sobra.
- El sonido (ritmo de llenado) aclara el mensaje.
- Conservar el mapa.
- Cambiar: agregar una sección guiada (un estadio pequeño y luego uno grande) y un filtro de capacidad por rango.

Lo que nos dijeron (según las notas del grupo):
- Subir el volumen del sonido y explicar mejor cómo funciona.
- Contar la conclusión de forma más clara.
- Los gráficos de la portada no se entendían.
- Mostrar a dónde va la gente de lunes a viernes (oficinas y aeropuerto) y el fin de semana (zonas de recreación).

Formulario completo del otro grupo (sobre la versión que vieron, V1):
- Mensaje: el título no deja clara la pregunta, y demasiados datos y filtros abruman.
- Contexto: falta la época del año.
- Escalas: los rangos 1–5, 5–25 y 125–1.100 pueden esconder información.
- Color: amarillo a rojizo, intuitivo; conservar.
- Minimalismo: demasiados filtros, y tres gráficos que sugieren más de un mensaje.
- Interacción: aporta, pero marea. Destacan el 3D.
- Sonido: muy bajo, no lo pudieron evaluar.
- Cambiar: subir el volumen, sacar lo que no suma al mensaje y quizás poner primero «explorar».

Decisiones: V2 adoptó el volumen, la conclusión, la portada y a dónde va la gente. V3 adoptó la pregunta explícita, el contexto de enero y las opciones plegadas. Descartamos poner primero «explorar» y mantener el 3D en la historia (ver V3).

## V2: primera iteración de diseño

13 de octubre de 2026 · commits `acde864` a la actualización de este registro.

### Qué cambió

- Portada: el gráfico marca las 01:00 y las 08:00 con sus cifras («3,3 veces más», «57 % menos») y tiene una leyenda de unidad y colores.
- Historia de 11 escenas. Nuevas: «Y va a Midtown» (lunes a viernes, 08:00, flujos), «De día, sale a pasear» (fin de semana, 13:00, llegadas comparadas) y «En resumen» (cuatro conclusiones con cifras).
- Textos corregidos: «Y termina cerca», «En 2021, la noche casi se apagó» y una tarifa 60 % más cara descontada la inflación.
- Sonido: pulsos más fuertes (de −26 a −12 dBFS). La leyenda (ritmo, tono, izquierda, derecha) se ve en la portada y en el taxímetro antes de activarlo.
- Gráfico de la historia: números en formato español (8.000), la unidad en el título y etiquetas que no se pisan.

### Por qué cambió

- La portada no se entendía (R2): no tenía eje, cifras ni leyenda. Anotar las dos horas del título resalta lo importante con atributos preatentivos (cáp. 20) y une la imagen con el mensaje (cáp. 19).
- La conclusión no era clara (R2): la historia terminaba en 2019 contra 2026, lejos del mensaje. El cierre repite las cifras clave: en lo explicativo se muestran las perlas, no las ostras (cáp. 19).
- A dónde va la gente (R2), con evidencia de los datos: a las 08:00 de un día de semana, 17 de los 40 flujos más grandes terminan en Midtown, y Midtown Center recibe 6,6 veces más llegadas que el fin de semana. A las 13:00 del fin de semana, Times Square recibe 387 llegadas al día contra 194. Así el contraste de día y de noche se ve en ambos tipos de día.
- Sonido (R2): la heurística «el sonido no se entiende sin explicación» (cáp. 22, cáp. 27). La leyenda aparece antes de activar el sonido. El volumen sube, pero sigue sin codificar datos.
- Crítica interna (cáp. 09): «vuelve a casa» y «solo la pandemia» afirmaban más que los datos. Comparar dólares de 2019 y 2026 sin descontar la inflación exageraba el alza (100 % en vez de 60 %).
- `src/story.test.ts` recalcula cada cifra nueva desde los datos (cáp. 08, inconsistencias numéricas).

### Qué se descartó

- «Gran flujo al aeropuerto» de lunes a viernes: los aeropuertos reciben cerca del 2 % de las llegadas y JFK tiene casi los mismos viajes todos los días. Solo LaGuardia tiene un 39 % más de salidas al día.
- Llamar «recreativas» a las zonas como si fuera un dato: se nombran los barrios, y «teatros, bares y tiendas» se presenta como contexto.
- Escala de cantidad en violeta (`c87f13e`, revertida en `5b94157`): separaba el naranjo de la cantidad del naranjo del fin de semana. Motivo del descarte: [completar; la pauta no acepta «no nos gustó»]. El cruce de colores sigue abierto.

## R3: revisión con el equipo docente

Martes 13 de octubre de 2026, sobre la V2. No tomamos notas de lo conversado y no las reconstruimos de memoria. Llevamos las tres preguntas de abajo; V3 las responde con nuestros argumentos.

Preguntas que llevamos:
1. ¿La portada se entiende sin explicación?
2. ¿«En resumen» cierra bien, o sobran escenas?
3. ¿Mantenemos el relieve 3D en la historia (el checklist nombra «3D innecesario»)?

## V3: segunda iteración de diseño

22 de octubre de 2026 · tag `v3`. Hecha el día de la entrega: el atraso es nuestro y lo dejamos visible en el historial.

### Qué cambió

- La portada pregunta antes de afirmar: «¿A qué hora y dónde se mueve Nueva York el fin de semana, comparado con lunes a viernes?».
- La portada dice por qué solo enero: para que la estación no se mezcle con el tipo de día.
- «Explora tú» muestra solo días, hora y zona. Año, llegadas, flujos y relieve 3D quedan en «Más opciones».
- La escena «La noche tiene relieve» (3D) pasa a «Donde la noche pesa más», en un mapa plano con la misma razón.
- Las escenas de 01:00 se rotulan «Noches de viernes y sábado». Sobre el mapa, el taxímetro lo aclara de madrugada.
- Leyendas: los extremos de la razón dicen «≥ 4×», y la escala de cantidad, que cada marca multiplica por 5.
- Sonido: una bocina corta bajo 15 km/h, más seguida cuanto más lento va el tráfico. Se suma a la leyenda del sonido.

### Por qué cambió

- R2, «no queda claro cuál es la pregunta»: la vista general debe responder una pregunta explícita (cap. 19 y E1 §1). La pregunta va arriba y el título la responde.
- R2, «falta la época del año»: es contexto que falta (heurística de Zuk-Carpendale). Elegimos enero a propósito, y ahora se dice en la portada.
- R2, «demasiadas opciones; uno se pierde»: menos es más (cap. 20). Shneiderman (cap. 25): primero lo necesario para el mensaje, y el detalle bajo demanda. Lo plegado sigue disponible.
- 3D en la historia: la R2 lo destacó, pero lo sacamos de la escena que compara East Village con JFK. La perspectiva y la oclusión distorsionan la comparación de alturas (cap. 10; heurística «las distancias visuales engañan»). Lo conservamos como capa opcional, que es lo que el otro grupo valoraba.
- «Sábado 01:00» es la noche del viernes: el rótulo anterior invitaba a una hipótesis errada (cap. 22).
- La razón satura en 4×: rotular el extremo evita leer «4×» donde hay 8× (cap. 11 y 15).
- R2, «los rangos de la escala esconden información»: mantenemos la escala logarítmica, porque los datos cubren 3 órdenes de magnitud y en escala lineal la zona mediana queda blanca (cap. 15). Lo que cambia es la leyenda, que explica el paso ×5.
- Bocina: el checklist pide que el tipo de sonido cambie con el dato, no solo su intensidad. Un earcon de atasco se entiende sin explicación (cap. 27, earcons y alarmas).

### Qué se descartó

- R2, «ir primero a explorar»: lo descartamos. El mensaje es explicativo y el martini glass pone primero la historia (cap. 19). El enlace «Ir directo a explorar» ya permite el otro orden.
- Sacar el 3D por completo: el otro grupo lo valoró para ubicar zonas, y como capa opcional no compite con el mensaje.
- Escala por cuantiles para responder a la crítica de los rangos: oculta las magnitudes reales.
- Reemplazar los pulsos por sonidos de autos grabados: no alcanzaba a probarse antes de la entrega, y la bocina cubre el cambio de timbre.

## V4: la versión final

22 de octubre de 2026 · tag `v4` (commits desde `d346538`; la escala violeta se probó en `d346538` y se revirtió en `9eede9f`). Evidencia en `docs/evidencia/v4/` (capturas y `recorrido.mp4` con sonido).

### Qué cambió

- «Comparar»: la lista pide 50 viajes al día y muestra la razón con su cantidad («East Village · 7,9× · 628 al día»). En el mapa, la zona se atenúa cuando tiene menos viajes. El tooltip también muestra la cantidad.
- En la historia, cada etiqueta del mapa lleva su cifra. La escena 1 etiqueta JFK (125 al día) junto al Upper East Side North (343).
- Un clic en el mapa o en el gráfico ya no saca de la historia. Cada tarjeta tiene el botón «Explorar desde aquí».
- La escena 7 dice «Los 40 empiezan y terminan en Manhattan», y la leyenda de flujos explica los puntos amarillos.

### Por qué cambió

- Razón sin magnitud (cap. 11 y 15; evidencia de los datos): a la 01:00, con umbral de 10 viajes, la lista ponía primero a Sunnyside (11,8×, 39 al día) y segundo a East Village (7,9×, 628). Eso contradecía la escena 6. Con 50 viajes, la lista y la historia dicen lo mismo, y la cantidad al lado evita leer «más veces» como «más viajes».
- Zonas pálidas: en el mapa de razón, Bushwick North (25 viajes, más de 4×) se veía igual de intenso que East Village (628). Atenuar por cantidad le baja el peso visual a una razón que sale de pocos viajes, sin cambiar la escala divergente.
- Área contra cantidad (heurística «las distancias visuales engañan»): JFK es la zona más grande del mapa, pero a las 08:00 es la número 15. La cifra en la etiqueta corrige la lectura donde ocurre.
- Interacción (cap. 25; heurística «la interacción no es descubrible»): un clic sin querer al hacer scroll llevaba a «Explora tú» sin aviso. Un botón explícito conserva la función de V1 sin sorprender.
- Texto: «Ninguno de los 40 sale de Manhattan» se puede leer de dos formas. El nuevo dice lo que comprueba `src/story.test.ts`.

### Qué se descartó

- Volver a la escala violeta (`d346538`, revertida en `9eede9f`): separaba el naranjo de la cantidad del naranjo del fin de semana, pero la R2 destacó el amarillo a rojizo como intuitivo, y en cada vista solo se usa una de las dos escalas. Mantenemos el cruce como limitación conocida: la leyenda del mapa dice «viajes por zona».
- Cartograma o hexágonos para que el área no pese: rompe la geografía que la R2 pidió conservar, y la etiqueta con cifra resuelve el caso de JFK.
- Gris para zonas con menos de 10 viajes en «Comparar»: Bushwick North (25) seguía igual de intenso. Atenuar de forma continua funciona mejor que un corte.
- Cambiar el mapeo del sonido (tono contra ritmo con las dos voces): a la 01:00 las velocidades difieren en un paso de la escala, y rehacerlo obligaría a probar todo el sonido de nuevo sin tiempo para hacerlo.
- Mostrar el año fuera de «Más opciones»: plegarlo fue una decisión de la V3 (detalle bajo demanda), y sigue disponible en el gráfico «Años».

### Balance del recorrido

- Mejoró desde V1: el mensaje es una pregunta con respuesta (V3); las afirmaciones que excedían los datos se corrigieron y cada cifra se prueba (V2); la portada se lee sin ayuda (V2); el sonido se explica antes de sonar y cambia de timbre con el atasco (V2, V3); y en V4 la razón y las etiquetas dejan de invitar a lecturas erradas.
- No cambió, a propósito: el martini glass (historia y después exploración), la escala logarítmica común a los ocho años en amarillo a rojizo, la razón como forma de comparar los tipos de día y el sonido de dos voces en estéreo. Cada uno se discutió (R2, V3) y lo mantuvimos con argumentos.

## Evaluación con usuarios

Pendiente: la ronda con una persona externa se registra en el documento de entrega.

## Pendiente

- Completar la R1 con los apuntes del grupo.
- Evaluación con usuarios: hacer la ronda real (think aloud con la hoja del observador).
