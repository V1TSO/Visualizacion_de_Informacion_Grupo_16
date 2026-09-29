# V1: decisiones iniciales

Pregunta: ¿qué cambia en los viajes de taxis amarillos entre lunes a viernes y el fin de semana, dónde y a qué hora?

Mensaje: el fin de semana, Nueva York no madruga: trasnocha. En enero de 2026, a las 08:00 del fin de semana hay un 57 % menos de viajes que un día de semana; a la 01:00, 3,3 veces más. La noche se concentra en East Village, West Village y el Lower East Side, termina cerca (Murray Hill, Kips Bay, Gramercy; 38 viajes al día ni salen de East Village) y es rápida: 27,4 km/h a las 05:00 contra 12,5 km/h a las 11:00 de un día de semana.

Contexto histórico: ocho eneros (2019–2026) repiten el patrón. Entre 00:00 y 05:00, el fin de semana tiene de 2,6 a 4,8 veces los viajes de un día de semana; en 2021, año de pandemia, baja a 1,5. Hoy hay la mitad de viajes que en 2019 y el viaje mediano cuesta un 60 % más, descontada la inflación de Nueva York (23,09 dólares contra 14,41 de 2019 en dólares de 2026).

Audiencia: personas interesadas en la vida urbana, sin formación en datos, que prueban la página por pocos segundos. Alcance: enero de 2019 a 2026 y taxis amarillos. No generalizar a toda la movilidad de Nueva York.

Cada decisión cita la cápsula (cáp.), la heurística de Zuk-Carpendale (H) o el mandamiento de la hoja de la cápsula 20 (M) en que se apoya.

## Estructura

- Martini glass: historia guiada de 8 escenas (explicativa) y después «Explora tú» (exploratoria) con el mismo mapa (cáp. 19). La portada transmite el mensaje sin interacción (E1 §1).
- Cada escena se marca con su día y hora; es una secuencia real, el reloj de la ciudad.
- Titulares que afirman: la portada, cada escena y el gráfico de la historia dicen lo que pasa (cáp. 19, M1). Al explorar, los títulos del gráfico describen la selección.
- Mantra de Shneiderman (cáp. 25, H12): vista general, filtros (año, días, salidas o llegadas, hora, capas), zoom (botones, Ctrl o ⌘ + rueda, y la cámara se acerca a la zona elegida) y detalle (tooltip, taxímetro, lista). Además: animación del día y cambio de representación (cantidad o comparación; viajes, velocidad o años).
- Tocar el mapa o un gráfico durante la historia salta a explorar desde esa vista; el tooltip lo avisa («Haz clic para explorar esta zona») para que la interacción sea descubrible (hoja del observador).

## Codificación

- Densidad (viajes por km²) en vez de conteos por zona: las zonas tienen áreas muy distintas (JFK mide 18 km², East Village 1 km²) y un coroplético de conteos da peso visual a las grandes (cáp. 15, «Valores absolutos vs. relativos»; H3). El tooltip muestra los viajes y la densidad; el taxímetro y las listas, los viajes.
- Escala logarítmica común a los ocho años, de 0,1 a 1.000 viajes/km², con marcas que multiplican por 10: el dato abarca cuatro órdenes de magnitud (cáp. 15). La leyenda lo explica en palabras, porque la escala log es menos intuitiva para público general.
- Paleta secuencial violeta para cantidad: no reutiliza el azul (lunes a viernes) ni el naranjo (fin de semana), que en curvas y en «Comparar» significan tipo de día (cáp. 11, consistencia entre vistas; M10). Varía en brillo, que el ojo lee como orden (cáp. 11). El amarillo taxi queda solo para «ahora o elegido».
- «Comparar»: fin de semana dividido por lunes a viernes a la misma hora, paleta divergente azul–blanco–naranjo, apta para daltonismo (H5). «Igual» es blanco y «menos de 1 viaje al día» es gris, para no confundirlos.
- El agua del mapa no cambia con la hora: un fondo que se oscurece altera cómo se perciben los colores vecinos (H4, contraste local; cáp. 6, el mapa de calor de genes). La hora sigue oscureciendo el fondo de la historia, fuera del mapa.
- Sin 3D en la historia (H8, cáp. 10, M5, checklist E1): la perspectiva deforma las alturas justo cuando la escena compara zonas. El relieve queda como capa opcional al explorar, con la advertencia «úsalo para ubicar, no para comparar».
- Flujos: arcos entre puntos interiores de las zonas, de claro (origen) a oscuro (destino). Grosor y cantidad de taxis animados crecen con los viajes, para que el movimiento (atributo preatentivo) no iguale flujos chicos y grandes (H6). Los viajes que no salen de su zona se muestran como anillos, porque no caben en un arco. La leyenda dice qué se recortó: los 40 mayores entre zonas distintas (o 6 por zona) con al menos medio viaje al día (cáp. 8, «si recortas, dilo»).
- Gráficos de mediodía a mediodía: el tiempo del día es cíclico y la noche (el mensaje) queda entera en el centro, no partida en los bordes (cáp. 15, escala temporal).
- Etiquetas directas sobre cada curva, en la hora donde más supera a la otra, en vez de una leyenda aparte (M12, H13). Azul continuo y naranjo punteado se distinguen también sin color.
- Etiquetas en el mapa solo para las zonas que cita la escena, o la zona elegida y sus tres flujos principales (cáp. 20, resaltar lo importante).
- Promedios por día de cada tipo para no confundir más fechas con más intensidad. Ejes desde cero (cáp. 8).
- Tarifa en dólares de enero de 2026, con el IPC del área de Nueva York (BLS, CUURS12ASA0): comparar dólares corrientes de 2019 y 2026 exageraba el alza (100 % en vez de 60 %) (cáp. 20, estadística sólida).
- Textos que no afirman más que los datos (cáp. 9): «termina cerca» y no «vuelve a casa», porque los datos dicen destinos, no hogares; «en 2021, año de pandemia», sin atribuir la causa.
- Taxímetro: hora, viajes y velocidad de la selección, con la hora a la que corresponde cada cifra.
- Paleta de interfaz: papel #f4f6f5, tinta #173c50, noche #152433, amarillo taxi #f6bd16. Barlow Condensed (señalética y taxímetro) y DM Sans, ambas sin serifas (cáp. 20).

## Sonido

- Iconos auditivos en vez de tonos abstractos: cada sonido es un auto que pasa (cáp. 27, iconos auditivos; T4). Se entiende sin explicación, que es una de las heurísticas de la hoja del observador.
- Ritmo = cantidad de viajes: pasan más autos (0,5 a 5 por segundo, relativo al máximo de ambas curvas de la selección).
- Tono y duración = velocidad mediana: el motor suena más agudo y el paso es más corto cuando el tráfico va más rápido, con caída de tono tipo Doppler al pasar. Es sintético porque la velocidad cambia de forma continua y un MP3 no captura esa rampa (T4, «sintético justificado»).
- Bocinas = atasco: aparecen bajo 15 km/h, más seguidas cuanto más lento va el tráfico. El tipo de sonido cambia con el dato, no solo su intensidad (checklist E1).
- Estéreo: lunes a viernes a la izquierda, fin de semana a la derecha; en «Comparar» suenan ambos, en los otros modos solo el tipo de día que se ve.
- Voz (Web Speech API): al llegar a cada escena, con sonido activado, se lee la hora y el título. Combina icono auditivo y voz, como el ejemplo esperado «Contraten dos personas» (T4); también ayuda a la accesibilidad (cáp. 27).
- El volumen no codifica nada. Cero viajes produce silencio.

## Alternativas descartadas

- Dashboard con todos los controles visibles desde el inicio: el mensaje dependía de hacer clic en lo correcto.
- Relieve 3D dentro de la historia: la perspectiva impedía comparar East Village con JFK (H8).
- Conteos por zona en el coroplético: exageraban las zonas grandes (cáp. 15).
- Escala de color amarillo–marrón: su naranjo competía con el naranjo del fin de semana (cáp. 11).
- Pulsos sinusoidales con escala pentatónica: no se entendían sin leer la explicación (cáp. 27).
- Fondo del mapa que se oscurece de noche: alteraba la lectura del color (H4).
- Tarifa en dólares corrientes: exageraba el alza (cáp. 20).
- Eje de 00:00 a 23:00: partía la noche en dos (cáp. 15).
- Menú desplegable de 263 zonas: se reemplazó por búsqueda y clic en el mapa.
- Dibujar millones de viajes individuales: sobreposición y costo.
- Colorear cada hora o año con un máximo distinto: impide comparar magnitudes.
- Escala por cuantiles: oculta magnitudes reales.
- Mapa de balance salidas − llegadas: queda para una iteración futura.

## Preguntas para R1

1. ¿La historia guiada se entiende sin explicación en pocos segundos, o las 8 escenas son demasiadas?
2. ¿La densidad por km² se entiende, o el público espera leer «viajes por zona»?
3. ¿Los autos que pasan y las bocinas se entienden sin leer la nota del taxímetro?

## Registro pendiente

Completar después de la revisión: fecha, feedback recibido, cambios adoptados o descartados y razones. Añadir capturas, video con sonido y referencia al commit real. Todavía no hay revisión docente ni evaluación con usuarios registrada.
