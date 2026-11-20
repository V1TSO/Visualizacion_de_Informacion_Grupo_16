# Registro de diseño · Entrega 2

Sigue la plantilla de la E2 (estado: V2): contexto general y, en orden, cada versión con la revisión que la siguió. El registro de la E1 está en `DESIGN.md`. Los campos que dependen de apuntes, fotos o videos del grupo dicen «[completar]».

Cada versión es un tag `e2-vN` publicado en `/e2/vN/modelo1/`, con un índice en `/versiones/`. `/modelo1/` muestra siempre la última.

## Contexto general

### Propósito de la fisicalización

En pantalla, la velocidad de los taxis era una cifra en el taxímetro y una curva: se lee, pero no se siente la diferencia entre 12,5 km/h a las 11:00 de un día de semana y 27,4 km/h a las 05:00 del fin de semana (enero de 2026). En la maqueta, la velocidad mediana de cada hora se vuelve distancia: un taxi de juguete avanza 5 s a esa velocidad y su aguja se detiene sobre una regla. Mismo tiempo, más lejos, más rápido. Lunes a viernes y fin de semana se comparan por dónde quedan sus banderitas (cap. 31). El sonido acompaña solo la ida: el tono sigue la velocidad, el ritmo los viajes de esa hora, la bocina marca el tráfico lento y el oído (izquierdo o derecho) dice el tipo de día (cap. 27). [completar: qué aporta según lo observado con usuarios]

### Procesamiento de los datos

Los mismos datos de la E1 (`public/data/years.json`): velocidad mediana por hora de salida (distancia / duración, viajes de 1 minuto a 3 horas) y viajes que empiezan en cada hora en un día promedio, de lunes a viernes y de fin de semana, en enero de 2019 a 2026. Ajuste para la maqueta: la regla va de 0 a 28 km/h, así que las pocas horas sobre 28 km/h (madrugadas, sobre todo de fin de semana) quedan al final de la regla.

## V1: la idea completa, simulada

3 de noviembre de 2026 · tag `e2-v1` (commit `5532f7c`, PR #3) · `/e2/v1/modelo1/`.

### Evidencia

[completar: fotos del estado físico de la V1 (maqueta o bocetos) y un video corto con el modelo 3D y el sonido.]

### Decisiones iniciales

- Fisicalización: la velocidad mediana de la hora elegida se vuelve distancia. El taxi avanza 5 s y la aguja marca la velocidad en una regla de 0 a 28 km/h, donde queda una banderita azul (lunes a viernes) o naranja (fin de semana) con la hora.
- Interacción tangible: una caja con perilla de hora (24 posiciones), interruptor de tipo de día y botón Arrancar. El taxi vuelve solo a la salida, despacio y en silencio.
- Sonido solo en la ida: tono = velocidad, ritmo = viajes de esa hora, bocina bajo 15 km/h, izquierda = lunes a viernes y derecha = fin de semana.
- Capa digital: el computador muestra la hora, la velocidad, los viajes y las curvas del día. Un Arduino Leonardo, enchufado al computador por un cable USB colgado de un poste, lee la caja y mueve un servo de rotación continua.
- Prototipo: un modelo 3D interactivo de la maqueta (Mago de Oz) mientras llegaban los materiales. El ciclo y los mensajes con el Arduino se simulan en la página.

### Por qué

- La posición sobre una escala común es la señal que mejor se compara (cap. 16): por eso la velocidad es una distancia en la regla y no un ángulo o un color.
- Con el tiempo fijo (5 s), la distancia es proporcional a la velocidad: la metáfora del taxi que «llega más lejos» calza con el dato.
- La vuelta no codifica datos y va siempre igual y en silencio, para que no compita con la ida (cap. 20, solo lo que suma al mensaje).
- El sonido repite la velocidad con el tono y agrega los viajes con el ritmo (cap. 27), en estéreo para separar los tipos de día, como en la E1.
- Prototipar primero en virtual (cap. 29) permitió discutir la experiencia completa antes de cortar cartón.

### Qué se descartó

[completar: alternativas que el grupo probó o discutió para la V1.]

## R1: revisión con el equipo docente

[completar: fecha, síntesis de lo discutido y decisiones: qué adoptamos, qué descartamos y por qué (máximo 10 líneas).]

## V2: primera iteración de diseño

19 de noviembre de 2026 · tag `e2-v2` (PR #4: commits `1599186`, `d14308d` y este registro) · `/e2/v2/modelo1/`.

### Evidencia

[completar: fotos del taxi con el celular encima y de la regla, y un video de una carrera con su sonido.]

### Qué cambió

- La maqueta se mueve de verdad. Un celular Android va sobre el taxi, alimenta al Arduino por un cable OTG y mueve el servo. El computador lo controla por Protobject; se unen escaneando un QR.
- El ciclo (5 s de ida, 3 s de pausa y vuelta) corre en el celular, junto al servo. El computador elige la velocidad con los datos, y su modelo 3D y su sonido siguen al taxi real.
- Los controles pasan al computador: hora, tipo de día, Arrancar, Detener, Volver a la salida y «Ya está en la salida». La perilla, el interruptor y el botón de la caja quedan opcionales.
- Calibración con el peso real: se prueban pulsos, se mide hasta dónde llega la aguja en 5 s y se interpola el pulso de cada velocidad. La vuelta se mide igual.
- Los pines siguen el firmware de Protobject (servo en D5, tope en D9), con resistencias pull-up internas.

### Por qué cambió

- Fidelidad (cap. 29): de la simulación de la V1 a una maqueta que se mueve, para discutir en la R2 la experiencia real y no una promesa. [completar: qué pidió la R1]
- El celular como actuador y fuente de energía (cap. 30, T5 y T7 con Protobject): sin el cable colgado del poste, el taxi recorre la avenida sin nada que lo frene ni lo desvíe.
- Con el celular sobre el taxi, su pantalla queda fuera de alcance: por eso todo se maneja desde el computador. La entrada pierde tangibilidad (la caja pasa a ser opcional); la fisicalización, el taxi recorriendo la regla, se mantiene. [completar: si la caja vuelve en la V3]
- Restricción técnica: el celular pesa [completar] g. Con el mismo pulso, el taxi avanzaba menos y la aguja marcaba otra velocidad. El pulso fija la velocidad que el servo intenta alcanzar, no su fuerza, así que se calibra lo que se lee: la distancia sobre la regla (cap. 16).
- El ciclo vive en el celular porque la red puede atrasarse, y el taxi debe detenerse a tiempo en la salida.
- Restricción técnica: sin microinterruptor, la vuelta seguía empujando contra la salida. Ahora termina con la velocidad de vuelta medida, y «Ya está en la salida» la corrige.

### Qué se descartó

- Controles en la pantalla del celular: sobre el taxi quedan fuera de alcance.
- «Calibrar la fuerza» del servo: el pulso solo fija la velocidad, así que se calibra la distancia.
- Estimar la vuelta como pulso × tiempo: con el peso del celular, el taxi seguía empujando contra la salida.
- Celular fijo junto a la avenida, con un cable de 2 m hasta el taxi: [completar: por qué lo pusimos arriba del taxi].

## Pendiente

- V1: fotos, video y alternativas descartadas. R1: apuntes del grupo.
- V2: fotos con el celular sobre el taxi, video con sonido y el peso del celular.
- El modelo 3D de la página todavía muestra la maqueta de la V1 (caja de controles y cable colgado del poste). Decidir si se actualiza en la V3.
- R2, V3, R3, V4, el feedback al otro grupo y la evaluación con usuarios (hoja del observador).
