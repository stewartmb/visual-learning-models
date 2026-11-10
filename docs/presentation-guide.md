# Guía inicial de exposición · ocho minutos

Fuente de las recomendaciones: el análisis exhaustivo HTML local `analisis_exhaustivo.html` de semana 12, clase 1. Los tiempos corresponden a la grabación; las referencias siguientes son paráfrasis salvo la expresión entre comillas.

## 0:00–1:00 · Preguntas, datos y unidad de análisis

“Organizamos el trabajo en entendimiento, diagnóstico y refinamiento”, retomando la tríada señalada alrededor de 35:49. Explicar que cada punto es una imagen representada por sus activaciones; no una neurona. Mostrar que T1 fija capa y cambia época, mientras T2 fija época y compara capas.

Relacionar con What–Why–How (16:17–16:49; 29:24–30:08). MNIST, 1000 IDs fijos y diez clases. Entrenamiento y prueba separados.

## 1:00–2:20 · Evolución entre épocas

Abrir T1 en capa 4, época 0: solo aparecen puntos iniciales. Reproducir o elegir las miniaturas y mostrar cómo se acumulan segmentos hasta la época activa. En «Ajustes de vista», elegir recorrido completo para consultar el resumen de las siete instantáneas. La captura de una capa en distintos momentos sigue la indicación de 44:07.

En esta secuencia, NH pasa de 43.25% a 96.40%, y trustworthiness de 88.736% a 99.229%. Aclarar que NH describe vecindarios de clases en 2D y no es la exactitud de clasificación. No afirmar que toda representación no entrenada de MNIST debe verse mezclada.

Explicar la advertencia de 45:24–46:12: proyecciones independientes podían saltar. Se emplea AlignedUMAP con IDs compartidos; fijar una semilla por sí solo no alinearía los estados. La regularización también puede atenuar movimientos.

## 2:20–3:10 · Por qué agrupamos las trayectorias

Abrir «Ajustes de vista» y alternar trayectorias rectas y agrupadas. Ajustar fuerza y cerrar el panel para comparar. Las líneas conectan la misma imagen, no imágenes vecinas. La fuerza solo cambia controles de dibujo. Las etiquetas ayudan a agrupar visualmente: la existencia de un haz no prueba separación aprendida.

El paper usa trayectorias agrupadas para evolución temporal y entre capas. Nuestra aproximación Bézier y paneles yuxtapuestos se atribuyen como adaptaciones; no se presenta CUBu como implementado.

## 3:10–4:20 · Diagnóstico con imágenes concretas

Ir a época 20 y seleccionar clases 3 y 5; activar errores. Abrir la matriz base y pulsar real 5 → predicción 3: aparecen tres imágenes en la muestra.

Hacer clic para inspeccionar MNIST #1393: etiqueta 5, predicción 3. La imagen tiene una forma ambigua; no se declara automáticamente que está mal etiquetada. Abrir «Historial y vecinos» para comparar los ejemplos originales. El profesor explicó la conexión entre confusión 3/5 e inspección de ejemplos en 41:04–41:25.

Recordar la recomendación alrededor de 49:40: investigar casos difíciles y robustez en lugar de eliminarlos para que el resultado se vea mejor.

## 4:20–5:20 · Evolución entre capas

Conservar una imagen fijada y pasar a T2. Localizar sus cuatro posiciones y conexiones. Cambiar de capa en el inspector por interacción con los puntos. La predicción sigue siendo la salida final, no una clasificación atribuida a cada capa.

En época 20, NH de las capas base es aproximadamente 91.57%, 95.15%, 95.63% y 95.93%. Es una observación de este experimento/proyección, no una ley universal. Comparar diferencias de vecindad con ejemplos originales.

## 5:20–6:30 · Evaluar el refinamiento

La sugerencia del profesor en 42:51–43:19 incluye erosión/dilatación; no mostró un experimento ejecutado en esa grabación. Se ensayó dilatación 3×3 en 25% del entrenamiento, con prueba original y mismas condiciones iniciales.

Resultados finales en 10000 pruebas: base 97.80%, dilatación 97.30%, diferencia −0.50 puntos porcentuales. En la muestra visual: 12 errores corregidos y 18 nuevos errores, con 16 imágenes erróneas en ambos modelos. Mostrar matrices e imágenes afectadas. No concluir que la dilatación siempre es perjudicial a partir de una semilla.

## 6:30–7:20 · Demostrar el mantra

Overview: todas las imágenes/trayectorias. Zoom/filter: selección de clases, errores y una región. Details: galería, ID fijo, probabilidades e historial. Conectar con el recorrido global → individual de 1:04:34–1:04:52.

## 7:20–8:00 · Conclusión con límites

Responder a la exigencia de sacar conclusiones de 55:06. La herramienta permite relacionar cambios de representación con imágenes y errores reales. La intervención ensayada no mejoró la exactitud final; se identifican ejemplos y clases para investigar. La proyección distorsiona, el agrupamiento guía la lectura y la animación interpola. Los gráficos ayudan a formular y comprobar hipótesis; no prueban causalidad por sí solos.

## Preguntas previsibles

- ¿Por qué el color verdadero? Permite evaluar mezcla entre clases conocidas sin cambiar su significado entre vistas.
- ¿Por qué no usar tamaño para confianza? Se reserva el punto como unidad uniforme; las probabilidades se comparan con barras de escala común.
- ¿Por qué curvas y miniaturas? Las curvas resumen correspondencias; las miniaturas permiten comparar estados sin depender de recordar una animación.
- ¿Por qué no solo exactitud? Un valor global no muestra qué imágenes fallan ni cómo se representan.
- ¿Se calculan vecinos en el gráfico? No: el inspector usa activaciones originales. NH y trustworthiness tienen funciones distintas.
- ¿Se copió un trabajo previo? Se atribuyen decisiones de diseño publicadas; el código, entrenamiento, datos derivados y análisis de resultados son propios de esta implementación, con asistencia de IA.
