# Guía inicial de exposición · ocho minutos

Fuente de las recomendaciones: el análisis exhaustivo HTML local `analisis_exhaustivo.html` de semana 12, clase 1. Los tiempos corresponden a la grabación; las referencias siguientes son paráfrasis salvo la expresión entre comillas.

## 0:00–1:00 · Preguntas, datos y unidad de análisis

La entrega se centra en entendimiento y diagnóstico, relacionándolos con las finalidades de visualización explicadas alrededor de 35:49. Explicar que cada punto es una imagen representada por sus activaciones; no una neurona. Mostrar que T1 fija capa y cambia época, mientras T2 fija época y compara capas.

Relacionar con What–Why–How (16:17–16:49; 29:24–30:08). MNIST, 1000 IDs fijos y diez clases. Entrenamiento y prueba separados.

## 1:00–2:20 · Evolución entre épocas

Abrir T1 en capa 4, época 0: solo aparecen puntos iniciales. Reproducir o elegir las miniaturas y mostrar cómo se acumulan segmentos hasta la época activa. En «Trayectorias → Recorrido», elegir recorrido completo para consultar el resumen de las siete instantáneas. La captura de una capa en distintos momentos sigue la indicación de 44:07.

En esta secuencia, NH pasa de 43.25% a 96.40%, y trustworthiness de 88.736% a 99.229%. Aclarar que NH describe vecindarios de clases en 2D y no es la exactitud de clasificación. No afirmar que toda representación no entrenada de MNIST debe verse mezclada.

Explicar la advertencia de 45:24–46:12: proyecciones independientes podían saltar. Se emplea AlignedUMAP con IDs compartidos; fijar una semilla por sí solo no alinearía los estados. La regularización también puede atenuar movimientos.

## 2:20–3:10 · Por qué agrupamos las trayectorias

En el panel izquierdo, alternar trayectorias rectas y agrupadas. Ajustar fuerza sin desplazar el mapa. Las líneas conectan la misma imagen, no imágenes vecinas. La fuerza solo cambia controles de dibujo. Las etiquetas ayudan a agrupar visualmente: la existencia de un haz no prueba separación aprendida.

El paper usa trayectorias agrupadas para evolución temporal y entre capas. Nuestra aproximación Bézier y paneles yuxtapuestos se atribuyen como adaptaciones; no se presenta CUBu como implementado.

## 3:10–4:20 · Diagnóstico con imágenes concretas

Ir a época 20 y seleccionar clases 3 y 5; activar errores. Abrir la matriz de confusión y pulsar real 5 → predicción 3: aparecen tres imágenes en la muestra.

Hacer clic para inspeccionar MNIST #1393: etiqueta 5, predicción 3. La imagen tiene una forma ambigua; no se declara automáticamente que está mal etiquetada. Revisar historial y vecinos originales en el panel derecho. El profesor explicó la conexión entre confusión 3/5 e inspección de ejemplos en 41:04–41:25.

Recordar la recomendación alrededor de 49:40: investigar casos difíciles y robustez en lugar de eliminarlos para que el resultado se vea mejor.

## 4:20–5:20 · Evolución entre capas

Conservar una imagen fijada y pasar a T2. Localizar sus cuatro posiciones y conexiones. Pasar sobre puntos de cada capa para actualizar los vecinos del inspector; hacer clic para fijar la imagen. La predicción sigue siendo la salida final, no una clasificación atribuida a cada capa.

En época 20, NH de las capas es aproximadamente 91.57%, 95.15%, 95.63% y 95.93%. Es una observación de este experimento/proyección, no una ley universal. Comparar diferencias de vecindad con ejemplos originales.

## 5:20–6:30 · Comprobar la interpretación de las proyecciones

Contrastar un caso seleccionado con sus seis vecinos en activaciones originales. Explicar que NH mide mezcla de clases en 2D y trustworthiness preservación de vecindarios: ninguna es la exactitud del clasificador.

El modelo obtiene 97.80% en las 10000 imágenes de prueba y 97.20% en la muestra visual equilibrada de 1000 imágenes. Mostrar la matriz de confusión para identificar qué pares de clases fallan. Las distancias del gráfico y la longitud de una curva no prueban causalmente cómo aprendió la red.

## 6:30–7:20 · Demostrar el mantra

Overview: todas las imágenes/trayectorias. Zoom/filter: selección de clases, errores y una región. Details: galería, ID fijo, probabilidades e historial. Conectar con el recorrido global → individual de 1:04:34–1:04:52.

## 7:20–8:00 · Conclusión con límites

Responder a la exigencia de sacar conclusiones de 55:06. La herramienta permite relacionar cambios de representación con imágenes y errores reales, identificar diferencias entre épocas y capas y examinar confusiones concretas. La proyección distorsiona, el agrupamiento guía la lectura y la animación interpola. Los gráficos ayudan a formular y comprobar hipótesis; no prueban causalidad por sí solos.

## Preguntas previsibles

- ¿Por qué el color verdadero? Permite evaluar mezcla entre clases conocidas sin cambiar su significado entre vistas.
- ¿Por qué no usar tamaño para confianza? Se reserva el punto como unidad uniforme; las probabilidades se comparan con barras de escala común.
- ¿Por qué curvas y miniaturas? Las curvas resumen correspondencias; las miniaturas permiten comparar estados sin depender de recordar una animación.
- ¿Por qué no solo exactitud? Un valor global no muestra qué imágenes fallan ni cómo se representan.
- ¿Se calculan vecinos en el gráfico? No: el inspector usa activaciones originales. NH y trustworthiness tienen funciones distintas.
- ¿Se copió un trabajo previo? Se atribuyen decisiones de diseño publicadas; el código, entrenamiento, datos derivados y análisis de resultados son propios de esta implementación, con asistencia de IA.


## Demostración nueva: una conclusión con evidencia

Después del overview, pulsar **Investigar 15 → 20**. Explicar que los conteos se obtienen de predicciones medidas y etiquetas, no de la forma del mapa. Se corrigen 6 errores, aparecen 8 y persisten 20: 26→28 en la muestra. La exactitud de prueba completa sigue siendo otra evaluación.

Elegir **Empiezan a fallar**, fijar MNIST #1182 (etiqueta 6): predicción 6→8. Conserva 1 de sus seis vecinos originales de capa 4; cinco cambian. La herramienta muestra la asociación con su representación, no demuestra que esos vecinos causaron la clasificación. Conectar vecinos para localizar sus posiciones y recuperar las imágenes. No borrar el caso difícil: enlazar con 49:40–49:56 del profesor.

Abrir T2 conservando el ID para comprobar la representación por capa; el cambio de vecinos usa capa 1 como referencia. Distinguir activaciones, proyección y salida final. Guardar una evidencia que permita reconstruir lo mostrado. Es el recorrido de lo general al caso concreto explicado en 1:04:34–1:04:52 y responde a la exigencia de obtener conclusiones de 54:26–55:54.

Las referencias de clase son paráfrasis del HTML de análisis; no se presentan como citas textuales inventadas.
