# Diseño visual · versión 0.3.0

La referencia principal es el enunciado entregado. La grabación se consulta mediante el análisis exhaustivo HTML local, no mediante el SRT. El paper guía la metodología y los trabajos publicados orientan los idioms.

## Jerarquía y reducción de controles

El espacio de trabajo reserva controles a la izquierda, mapa en el centro e inspección a la derecha. Los tres mantienen su tamaño: hover, filtros, selección y ajustes no desplazan el mapa. El encabezado, la barra de herramientas y las miniaturas son compactos; la proyección usa la altura restante de la ventana. En una ventana de 1512 × 1050, T1 dispone de unos 810 píxeles de altura para el mapa.

Una sola leyenda permite combinar clases, con un único filtro «Solo errores». Los casos fuera del filtro conservan puntos pequeños, grises y tenues; sus trayectorias no se dibujan. Los números 0–9 sitúan la mediana de cada clase calculada con toda la cohorte, sin alterar la proyección. Son referencias de clase, no límites ni regiones de decisión. Cuando la mezcla es alta (NH < 0.6), solo se rotulan las clases filtradas para evitar sugerir grupos separados. «Acercar al filtro» permite ajustar explícitamente el zoom; filtrar no cambia las coordenadas ni la escala.

T1 conserva siete miniaturas como único selector de época; T2 tiene un selector compacto. Trayectorias, recorrido, fuerza, opacidad y velocidad permanecen en la columna izquierda. No hay secciones desplegables que cambien el tamaño del mapa. Diagnóstico, guía y método usan diálogos superpuestos. En móvil, los controles se abren sobre la vista.

El hover actualiza la imagen, etiqueta, predicción, tres mayores puntuaciones más clase real, historial breve y seis vecinos originales en el panel derecho. Solo añade un contorno al punto; no atenúa los demás ni modifica las curvas. El clic fija la imagen y atenúa las demás. Al salir de otro punto se recupera el detalle fijado. La galería de selección regional ocupa ese mismo panel.

T2 distribuye las cuatro capas en 2 × 2 cuando la altura disponible lo favorece, con orden explícito L1 → L2 ↓ L3 ← L4. En superficies anchas y bajas conserva cuatro columnas. Todos los paneles usan la misma escala isotrópica. Esta disposición aumenta el espacio útil de las proyecciones; las conexiones siguen uniendo estados medidos de la misma imagen.

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
| Acierto/error final del modelo | Círculo/triángulo; errores ligeramente ampliados para localizarlos |
| Identidad entre estados | Trayectoria individual con extremos medidos |
| Avance temporal T1 | Luminancia ordenada dentro del matiz de clase |
| Orden de capas T2 | Posición y flechas de orden de panel |
| Selección | Borde oscuro y mayor énfasis; resto atenuado |
| Probabilidad estimada | Longitud de barra en escala común 0–1 |
| Imagen original | Posición espacial de píxeles y escala de grises |
| Frecuencia de confusión | Color secuencial púrpura en escala 0–100% por fila |

En la muestra hay 100 imágenes por clase, por lo que el conteo y el porcentaje por fila coinciden numéricamente en la matriz. El detalle de celda indica ambos. Las exactitudes sobre 10000 pruebas se distinguen de las métricas sobre 1000 imágenes visualizadas.

## Agrupamiento en ambas tareas

T1 conecta 1000 imágenes a través de siete épocas: 6000 segmentos. T2 conecta 1000 imágenes entre cuatro capas: 3000 segmentos. Son relaciones de identidad, no aristas de vecindad ni conexiones neuronales.

Las curvas Bézier usan controles atraídos hacia centroides de clase, adaptación del precedente de Paolo. Fuerza inicial 0.45, visibilidad inicial 12% tras revisión visual. Se conservan todos los puntos de paso correspondientes a estados medidos. El usuario puede retirar el agrupamiento y mostrar conexiones rectas; también puede ocultar conexiones.

Desde v0.1.2, la atracción se aplica únicamente en dirección perpendicular a la conexión entre extremos. Los controles mantienen posiciones longitudinales de 1/3 y 2/3 y una desviación transversal máxima del 25% de su distancia. Una saturación suave evita saltos al variar la fuerza. La curva avanza siempre entre sus extremos sin retroceder en esa dirección; extremos coincidentes no producen un bucle. La regla se aplica tanto en T1 como T2 y no cambia las proyecciones.

La geometría interior es esquemática. El método usa etiquetas en el dibujo: un haz de líneas de igual clase no es evidencia independiente de que la red separó clases. La proyección no recibe etiquetas. Esta implementación no reproduce el algoritmo CUBu del paper.

T1 muestra de forma predeterminada solo los segmentos hasta la época activa: época 0 sin líneas, época 1 con 0→1, época 2 con 0→1→2, etc. **Trayectorias → Recorrido → Completo (0–20)** conserva el overview de todas las trayectorias. La escala de luminancia mantiene el significado temporal entre estados. La selección y la reproducción respetan el mismo límite temporal. T2 sigue conectando capas en una época fija.

La referencia de época 0 se conserva por su valor para comparar antes/durante/después del entrenamiento. **Atenuar primer tramo (0→1)** reduce únicamente su opacidad de contexto al 12% del valor habitual; no cambia los datos, los demás segmentos ni los puntos. La trayectoria seleccionada conserva su énfasis para inspeccionar esa transición. El control se ofrece solo en T1.

## Mantra

- Overview: toda la cohorte, miniaturas/paneles y trayectorias acumuladas. El resumen temporal completo se activa mediante una opción explícita.
- Zoom/filter: zoom, desplazamiento, clases, errores, matriz y brush.
- Details: hover en un panel derecho estable; clic para fijar, atenuar el resto y seguir una trayectoria. Historial y vecinos visibles sin desplegables.

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
