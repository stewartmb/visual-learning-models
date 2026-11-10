# Diseño visual · versión 0.5.0

La referencia principal es el enunciado entregado. La grabación se consulta mediante el análisis exhaustivo HTML local, no mediante el SRT. El paper guía la metodología y los trabajos publicados orientan los idioms.

## Jerarquía y reducción de controles

El espacio de trabajo reserva controles a la izquierda, mapa en el centro e inspección a la derecha. Los tres mantienen su tamaño: hover, filtros, selección y ajustes no desplazan el mapa. El encabezado, la barra de herramientas y las miniaturas son compactos; la proyección usa la altura restante de la ventana. En una ventana de 1512 × 1050, T1 dispone de unos 810 píxeles de altura para el mapa.

Una sola leyenda permite combinar clases, con un único filtro «Solo errores». El botón con borde «Limpiar filtros» permanece visible debajo: se habilita al activar filtros y queda deshabilitado cuando no hay ninguno. Los casos fuera del filtro conservan puntos pequeños, grises y tenues; sus trayectorias no se dibujan. Los números 0–9 sitúan la mediana de cada clase calculada con toda la cohorte, sin alterar la proyección. Son referencias de clase, no límites ni regiones de decisión. Cuando la mezcla es alta (NH < 0.6), solo se rotulan las clases filtradas para evitar sugerir grupos separados. «Acercar al filtro» permite ajustar explícitamente el zoom; filtrar no cambia las coordenadas ni la escala.

T1 conserva siete miniaturas como único selector de época; T2 tiene un selector compacto. Trayectorias, recorrido, fuerza, opacidad y velocidad permanecen en la columna izquierda. En comparación directa se retiran controles de agrupamiento que no aplican. No hay secciones desplegables que cambien el tamaño del mapa. Diagnóstico, guía y método usan diálogos superpuestos. En móvil, los controles se abren sobre la vista.

El hover actualiza la imagen, etiqueta, predicción, tres mayores puntuaciones más clase real, historial breve y seis vecinos originales en el panel derecho. Solo añade un contorno al punto; no atenúa los demás ni modifica las curvas. El clic fija la imagen y atenúa las demás. Al salir de otro punto se recupera el detalle fijado. La galería de selección regional ocupa ese mismo panel.

T2 distribuye las cuatro capas en 2 × 2 cuando la altura disponible lo favorece, con orden explícito L1 → L2 ↓ L3 ← L4. En superficies anchas y bajas conserva cuatro columnas. Todos los paneles usan la misma escala isotrópica. Esta disposición aumenta el espacio útil de las proyecciones; las conexiones siguen uniendo estados medidos de la misma imagen.

## Comparar, encontrar un caso y comprobarlo

T1 incorpora comparación explícita A→B. Las miniaturas siguen siendo el único selector de B; el control A tiene otra función: elegir la referencia. La curva es de lectura y no añade otro selector. La comparación es estática y pausa la reproducción; al salir vuelven los recorridos acumulados y su animación.

Los cuatro filtros son una partición de la cohorte según corrección respecto de la etiqueta verdadera: error→acierto, acierto→error, error→error y acierto→acierto. «Siguen fallando» no implica misma clase predicha. Se pueden combinar con clases; sus conteos usan esas clases, no el filtro de errores ni la selección regional. Al elegir una transición se limpian filtros incompatibles de errores y matriz, y la galería muestra sus ejemplos. «Limpiar filtros» retira la transición y clases, sin cambiar A/B.

El círculo vacío muestra A y el símbolo lleno B; la conexión directa preserva los dos extremos medidos. Se dibujan pares para cambios de error, la selección regional o la imagen fijada, evitando duplicar las 1000 trayectorias de todo el conjunto. «Siguen acertando» mantiene puntos y permite fijar un caso sin añadir 966 conexiones. No se conectan coordenadas de secuencias independientes. El zoom explícito ajusta conjuntamente A y B.

La comparación de seis vecinos usa IDs calculados en las activaciones originales. En T1 contrasta A/B en la capa fija; en T2 compara la capa inspeccionada con capa 1, en la misma época. Un borde inferior distingue vecinos nuevos. Los vínculos opcionales del mapa corresponden a esos vecinos originales, aunque puedan quedar separados en 2D; solo se activan con una imagen fijada, nunca por hover.

La curva de T1 compara exactitud y NH de la misma cohorte de 1000 imágenes. En T2 compara NH con trustworthiness de cada capa. Ambas usan escala porcentual común, con definiciones y sin interpretación causal. T1 muestra una referencia A punteada y B continua. Los intervalos entre checkpoints no son uniformes en entrenamiento.

«Guardar evidencia» captura mapa y datos de un mismo estado, con predicciones, cohortes, selección, vecinos e imagen fijada, en un HTML autónomo. El reporte conserva IDs y límites de interpretación; no produce explicaciones causales automáticas.

## Contexto de clases sin bolitas

Contornos KDE de D3, calculados con las 100 imágenes de cada clase, independientemente de filtros. La cuadrícula canónica es 512×512 en el dominio normalizado [-1.04,1.04]², bandwidth 9 y umbral .008 puntos/píxel². Los parámetros son fijos para evitar reescalar cada clase/estado a una apariencia de separación. Hay un nivel, borde fino y relleno tenue; las etiquetas son números simples con halo claro, sin círculo. No se asigna un porcentaje de cobertura al contorno.

Si NH<.6 se muestran únicamente clases elegidas, para reducir saturación en estados muy mezclados. Durante la transición animada se retiran temporalmente los contornos: las posiciones intermedias son interpolaciones, no nuevas estimaciones de densidad. Al terminar reaparece el estado medido. El interruptor «Contexto de clases» retira contornos y etiquetas sin mover puntos.

## What / Why / How

**What:** 1000 imágenes de MNIST con IDs fijos, etiquetas verdaderas, activaciones de cuatro capas en siete épocas, predicciones y probabilidades estimadas de un único MLP entrenado con imágenes originales.

**Why:** entender cambios durante el entrenamiento, comparar capas y diagnosticar imágenes difíciles. Las dos tareas principales son las del enunciado: épocas y capas. No se implementa como tarea principal la T2 de relaciones entre neuronas del paper.

| Vista | Idiom | Se fija | Se compara |
|---|---|---|---|
| T1 | Proyección con trayectorias agrupadas, puntos del estado activo, small multiples y animación | Capa | Épocas |
| T2 | Scatterplots yuxtapuestos con trayectorias agrupadas entre paneles | Época | Capas |
| Inspector | Imagen, barras horizontales y secuencia de predicciones | ID de imagen | Clases y estados |
| Galería | Small multiples de imágenes | Selección de IDs | Ejemplos originales |
| Diagnóstico | Matriz de confusión | Época y cohorte | Predicción vs. clase verdadera |

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

AlignedUMAP relaciona estados mediante IDs. La alineación regulariza movimientos y puede suprimir parte de los cambios; no garantiza fidelidad. Se conserva escala isotrópica por secuencia completa. El encuadre usa los límites X/Y de todos los estados, con un margen de 4% del mayor rango por lado, y escala uniforme limitada por el ancho o alto disponible. Sustituye el dominio cuadrado vacío, sin cambiar coordenadas ni reajustar la escala al cambiar de época. Las secuencias distintas tienen sistemas de coordenadas propios; no se anima una transición entre sistemas independientes como si midiera desplazamiento comparable.

Los vecinos del inspector se calculan en activaciones, no en 2D. NH con k=6 evalúa mezcla de clases en la proyección; trustworthiness con k=10 evalúa preservación de vecindarios originales. Se informa la capa a la que corresponden las métricas de T2.

Los segmentos animados interpolan estados medidos. Una mayor separación o trayectoria más larga no prueba mejor generalización ni explica causalmente la predicción. Las curvas se contrastan con imágenes, vecinos, métricas y resultados de prueba.

## Procedencia del diseño

- Paper, sección 5.4: trayectorias de observaciones entre capas y épocas; problema de comparabilidad de proyecciones.
- Paolo Vásquez: capas yuxtapuestas, color de clase y agrupamiento mediante centroides.
- Ricardo Amiel: miniaturas temporales, filtros e inspector de imágenes.
- Implementación compartida por un compañero, revisada localmente: motivación de la curva coordinada y de vincular representación con comportamiento; datos, comparador y código nuevos se implementan sobre nuestro modelo.
- Clase: What–Why–How; entendimiento y diagnóstico mediante ejemplos; estabilidad de la evolución; conclusiones y mantra.

El código es original. Los datos y resultados se generaron para esta versión.


## Legibilidad y espacio en 0.5.0

Las columnas laterales se amplían de manera responsive (224/340 píxeles en escritorio medio, 240/370 a partir de 1700), con controles de al menos 33–35 píxeles y textos de 12–14. La proyección conserva toda la altura central. No se estira la geometría para llenar huecos: el espacio necesario se calcula con el rango real de toda la secuencia.

La curva se fija arriba del panel derecho, mide 174 píxeles de alto y sus valores activos se muestran en texto. Hover consulta una época/capa sin cambiar el estado ni añadir un selector duplicado. Perfil, galería y acciones se desplazan en su propia área; la curva y el mapa conservan sus posiciones. En móvil, los detalles mantienen el panel superpuesto desplazable.

«Encuadrar estado» está siempre disponible; con filtros cambia a «Encuadrar filtro». Ajusta explícitamente los estados de las conexiones visibles, conserva escala uniforme y deja un margen de 10%. «Vista completa» recupera la escala común de secuencia. Filtrar, pasar el cursor y cambiar de época no aplican este zoom por sí solos.

Entre 761 y 1100 píxeles se usa todo el ancho para el mapa, los controles se abren superpuestos y la curva queda en una franja inferior fija. El detalle se consulta en un panel superpuesto independiente que puede cerrarse sin ocultar la curva. Se evita dejar tres columnas estrechas en tablet.
