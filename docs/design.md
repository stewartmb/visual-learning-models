# Diseño visual · versión 0.1.1

La referencia principal es el enunciado entregado. La grabación se consulta mediante el análisis exhaustivo HTML local, no mediante el SRT. El paper guía la metodología y los trabajos publicados orientan los idioms.

## What / Why / How

**What:** 1000 imágenes de MNIST con IDs fijos, etiquetas verdaderas, activaciones de cuatro capas en siete épocas, predicciones y probabilidades estimadas. Dos experimentos con las mismas particiones e inicialización.

**Why:** entender cambios durante el entrenamiento; comparar capas; diagnosticar imágenes difíciles; evaluar una intervención. Las dos tareas principales son las del enunciado: épocas y capas. No se implementa como tarea principal la T2 de relaciones entre neuronas del paper.

| Vista | Idiom | Se fija | Se compara |
|---|---|---|---|
| T1 | Proyección con trayectorias agrupadas, puntos del estado activo, small multiples y animación | Capa | Épocas |
| T2 | Scatterplots yuxtapuestos con trayectorias agrupadas entre paneles | Época | Capas |
| Inspector | Imagen, barras horizontales y secuencia de predicciones | ID de imagen | Clases y estados |
| Galería | Small multiples de imágenes | Selección de IDs | Ejemplos originales |
| Diagnóstico | Matrices de confusión yuxtapuestas | Época y cohorte | Predicción vs. verdad; base vs. refinado |

## Marcas y canales

| Significado | Marca y canal |
|---|---|
| Estado de una imagen | Punto en coordenadas x/y de una proyección |
| Clase verdadera | Matiz fijo Tableau10, dominio explícito 0–9 |
| Acierto/error final del modelo | Círculo/triángulo con área aproximadamente igual |
| Identidad entre estados | Trayectoria individual con extremos medidos |
| Avance temporal T1 | Luminancia ordenada dentro del matiz de clase |
| Orden de capas T2 | Posición horizontal de panel |
| Selección | Borde oscuro y mayor énfasis; resto atenuado |
| Probabilidad estimada | Longitud de barra en escala común 0–1 |
| Imagen original | Posición espacial de píxeles y escala de grises |
| Frecuencia de confusión | Color secuencial púrpura en escala 0–100% por fila |

En la muestra hay 100 imágenes por clase, por lo que el conteo y el porcentaje por fila coinciden numéricamente en la matriz. El detalle de celda indica ambos. Las exactitudes sobre 10000 pruebas se distinguen de las métricas sobre 1000 imágenes visualizadas.

## Agrupamiento en ambas tareas

T1 conecta 1000 imágenes a través de siete épocas: 6000 segmentos. T2 conecta 1000 imágenes entre cuatro capas: 3000 segmentos. Son relaciones de identidad, no aristas de vecindad ni conexiones neuronales.

Las curvas Bézier usan controles atraídos hacia centroides de clase, adaptación del precedente de Paolo. Fuerza inicial 0.45, visibilidad inicial 12% tras revisión visual. Se conservan todos los puntos de paso correspondientes a estados medidos. El usuario puede retirar el agrupamiento y mostrar conexiones rectas; también puede ocultar conexiones.

La geometría interior es esquemática. El método usa etiquetas en el dibujo: un haz de líneas de igual clase no es evidencia independiente de que la red separó clases. La proyección no recibe etiquetas. Esta implementación no reproduce el algoritmo CUBu del paper.

Desde v0.1.1, T1 muestra de forma predeterminada solo los segmentos hasta la época activa: época 0 sin líneas, época 1 con 0→1, época 2 con 0→1→2, etc. La opción **Mostrar recorrido completo (0–20)** es explícita y conserva el overview de todas las trayectorias. La escala de luminancia mantiene el significado temporal entre estados. La selección, el hover y la reproducción respetan el mismo límite temporal. T2 sigue conectando capas en una época fija.

## Mantra

- Overview: toda la cohorte, miniaturas/paneles y trayectorias acumuladas. El resumen temporal completo se activa mediante una opción explícita.
- Zoom/filter: zoom, desplazamiento, clases, errores, matriz y brush.
- Details: hover, selección fija, imagen original, historial, probabilidades y vecinos originales.

Los filtros nunca recalculan las proyecciones. La selección sigue IDs. La galería es paginada. El mouse tiene modos separados para desplazamiento y selección de región. Se permite limpiar selección, filtros y zoom por separado.

La reproducción temporal termina en la última instantánea y puede pausarse. En T2 se revelan sucesivamente las cuatro capas, conservando la época. Las miniaturas temporales tienen espaciamiento uniforme como instantáneas, con números de época explícitos que muestran intervalos desiguales.

## Integridad de comparación

AlignedUMAP relaciona estados mediante IDs. La alineación regulariza movimientos y puede suprimir parte de los cambios; no garantiza fidelidad. Se conserva escala isotrópica por secuencia completa. Las secuencias de capas o experimentos distintos tienen sistemas de coordenadas propios; no se anima una transición entre sistemas independientes como si midiera desplazamiento comparable.

Los vecinos del inspector se calculan en activaciones, no en 2D. NH con k=6 evalúa mezcla de clases en la proyección; trustworthiness con k=10 evalúa preservación de vecindarios originales. Se informa la capa a la que corresponden las métricas de T2.

Los segmentos animados interpolan estados medidos. Una mayor separación o trayectoria más larga no prueba mejor generalización ni explica causalmente la predicción. Las curvas se contrastan con imágenes, vecinos, métricas y resultados de prueba.

## Procedencia del diseño

- Paper, sección 5.4: trayectorias de observaciones entre capas y épocas; problema de comparabilidad de proyecciones.
- Paolo Vásquez: capas yuxtapuestas, color de clase y agrupamiento mediante centroides.
- Ricardo Amiel: miniaturas temporales, filtros e inspector de imágenes.
- Clase: What–Why–How; entendimiento, diagnóstico y refinamiento; recuperar ejemplos; estabilidad de la evolución; conclusiones y mantra.

El código es original. Los datos y resultados se generaron para esta versión.
