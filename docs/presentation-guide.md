# Guion de exposición · Visual Learning Models

Doce diapositivas principales y dos anexos de respaldo. Duración orientativa: 10–12 minutos, incluyendo las acciones en vivo. Cada afirmación se vincula con una vista y un resultado del experimento.

## Preparación

1. Abrir la aplicación Flask en http://127.0.0.1:5123/ o el HTML interactivo sin conexión.
2. Usar una ventana de escritorio amplia. Recargar para comenzar sin filtros, con T1, capa 4 y época 0.
3. Abrir la presentación. El guion indica qué decir y qué mostrar. Las diapositivas conservan las capturas como respaldo de la demostración.
4. Los IDs 1182 y 1393 se encuentran con el buscador del inspector. En ventana estrecha, abrir Controles para los selectores laterales.

## Recorrido resumido

| Diapositiva | Qué se demuestra | Control o vista |
|---|---|---|
| 1 | Cómo aprende una red | Portada con un recorrido real entre capas. |
| 2 | Una imagen, distintas representaciones | Punto, color de clase verdadera, forma de acierto/error, imagen original e inspector. |
| 3 | Las clases se separan durante el entrenamiento | Los mismos 1000 IDs en la misma secuencia y los valores de NH en la curva derecha. |
| 4 | La mayor mejora observada aparece al inicio | Exactitud de la muestra: 10,1%, 92,6% y 97,2%. NH en la misma cohorte. |
| 5 | Las capas refinan una separación que ya existe | Dos mapas sin conexiones entre paneles, con escala común. NH por capa en la curva. |
| 6 | Los vecinos del seis #1182 pasan a ser ochos | Dígito real 6, trayecto entre capas y filas de clases de sus seis vecinos originales. |
| 7 | Ocho imágenes empiezan a fallar al seguir entrenando | Conteos 6 corregidas, 8 nuevos errores, 20 errores persistentes y 966 aciertos persistentes. |
| 8 | El mismo seis cambia de acierto a error | Predicción 6 en época 15 y 8 en época 20, etiqueta real 6. Un vecino conservado de seis. |
| 9 | El cinco #1393 mantiene un error difícil | Tres imágenes en la confusión 5/3, el dígito 1393, historial de predicción y vecinos originales. |
| 10 | El mantra organiza la investigación | Overview, filtro/zoom y detalle, con mapa estable y galería de selección. |
| 11 | Qué permiten afirmar las visualizaciones | Diferencia entre posiciones medidas y dibujo de las conexiones, datos del experimento y definiciones de métricas. |
| 12 | La mejora global convive con errores individuales | Separación temporal, refinamiento por capas y cambio de errores, resumidos con cifras de la misma cohorte. |

## 01. Cómo aprende una red

**Acción en pantalla.** Abrir la presentación. Tener la aplicación en T1, capa 4, época 0.

**Evidencia que debe verse.** Portada con un recorrido real entre capas.

**Qué decir.**

> Queremos entender qué cambia dentro de una red cuando aprende y qué pasa con los ejemplos que sigue confundiendo. Seguimos las mismas mil imágenes de MNIST durante siete instantáneas del entrenamiento y en cuatro capas. La exposición conecta cada hallazgo con una vista que podemos reproducir en la herramienta.

**Límite que hay que respetar.** Los resultados corresponden a este modelo y a esta cohorte.

**Rúbrica.** Justificación del diseño y objetivo

## 02. Una imagen, distintas representaciones

**Acción en pantalla.** T2, Explorar, época 20. Pasar el cursor por un punto y después hacer clic. Liberar la selección.

**Evidencia que debe verse.** Punto, color de clase verdadera, forma de acierto/error, imagen original e inspector.

**Qué decir.**

> Cada punto representa una imagen según las activaciones que produce en una capa. El color mantiene su clase verdadera en todas las vistas. Un triángulo señala que la salida final del modelo se equivoca. Los ejes son dimensiones de la proyección. Al pasar el cursor recuperamos la imagen y al hacer clic fijamos su identidad. Así conectamos el resumen visual con el dato original.

**Límite que hay que respetar.** El punto no es una neurona. Los contornos son concentración estimada de clases, no fronteras de decisión.

**Rúbrica.** Claridad de marcas, canales e interacción

**Conexión con la clase.** What–Why–How, 16:17–16:49. Inspección de imágenes y confusión 3/5, 41:04–41:25. Paráfrasis del análisis HTML de la clase.

## 03. Las clases se separan durante el entrenamiento

**Acción en pantalla.** T1, capa fija 4. Poner Opacidad al 0%. Alternar miniaturas de época 0 y 20. Mantener Vista completa para conservar escala.

**Evidencia que debe verse.** Los mismos 1000 IDs en la misma secuencia y los valores de NH en la curva derecha.

**Qué decir.**

> Primero fijamos la capa 4 y comparamos la red inicial con la época 20. La nube inicial mezcla más las clases. Después aparecen regiones mucho más definidas. Lo contrastamos con NH, la proporción de vecinos de igual clase en el mapa: pasa de 43,3 a 96,4 por ciento. Cambian las representaciones de las mismas imágenes. Los filtros no recalculan el mapa y ambos estados comparten escala.

**Límite que hay que respetar.** NH mide vecindarios en 2D. No equivale a exactitud y puede verse afectado por la proyección.

**Rúbrica.** Hallazgo de formación y separación de grupos, T1

**Conexión con la clase.** Capturar una capa en distintos momentos, 43:51–44:31. Paráfrasis del análisis HTML.

## 04. La mayor mejora observada aparece al inicio

**Acción en pantalla.** T1, capa 4. Consultar épocas 0, 1 y 20 en las miniaturas y pasar por la curva de Separación y aciertos.

**Evidencia que debe verse.** Exactitud de la muestra: 10,1%, 92,6% y 97,2%. NH en la misma cohorte.

**Qué decir.**

> La primera época contiene el mayor salto entre las instantáneas guardadas. La exactitud de estas mil imágenes pasa de 10,1 a 92,6 por ciento y llega a 97,2 al final. El avance posterior es más pequeño. Mostramos exactitud junto a NH para separar el comportamiento del clasificador de la organización de su representación proyectada.

**Límite que hay que respetar.** Las instantáneas están espaciadas de forma desigual. No interpretamos la pendiente como una velocidad continua del aprendizaje.

**Rúbrica.** Hallazgo sobre comportamiento del aprendizaje, interacción de consulta

## 05. Las capas refinan una separación que ya existe

**Acción en pantalla.** T2, época fija 20. Comparar. Referencia A: capa 1. Elegir capa 4 en las miniaturas. Quitar selección si la hay.

**Evidencia que debe verse.** Dos mapas sin conexiones entre paneles, con escala común. NH por capa en la curva.

**Qué decir.**

> Ahora mantenemos fija la época y cambiamos la capa. La primera capa ya organiza bastante bien las clases. En la cuarta vemos cambios de forma y vecindad, acompañados por un NH que pasa de 91,6 a 95,9 por ciento. La vista permite comparar ambas sin recordar una animación. No afirmamos que cada capa mejore siempre cualquier red. Describimos el patrón medido en este experimento.

**Límite que hay que respetar.** Estos mapas pertenecen a la misma secuencia T2. No comparamos sus coordenadas absolutas con las de T1.

**Rúbrica.** Cumplimiento de T2 y hallazgo de refinamiento

## 06. Los vecinos del seis #1182 pasan a ser ochos

**Acción en pantalla.** En T2, Comparar capas 1 y 4. Buscar ID 1182. Activar Conectar vecinos en el mapa y revisar Vecinos por capa. Elegir capa 2 para comprobar que allí ya aparecen seis ochos. Volver a capa 4, pulsar Explorar, ajustar Agrupamiento por encima de 0% y pulsar Encuadrar imagen para mostrar el recorrido numerado.

**Evidencia que debe verse.** Dígito real 6, trayecto entre capas y filas de clases de sus seis vecinos originales.

**Qué decir.**

> Bajamos al caso concreto. Esta imagen está etiquetada como seis y la salida final predice ocho. En la capa 1, tres de sus seis vecinos originales son seises, dos son ochos y uno es nueve. Desde la capa 2, los seis vecinos son ochos. Estos vecinos se calculan en las activaciones originales de la muestra, no por cercanía en el dibujo. El caso muestra por qué una mejora global de separación puede coexistir con una representación problemática de una imagen.

**Límite que hay que respetar.** La asociación entre vecindario y error es exploratoria. No prueba que los vecinos hayan causado la predicción.

**Rúbrica.** Insight entre capas y detalle verificable

**Conexión con la clase.** Relacionar visualización con ejemplos originales, 41:04–41:25. No eliminar casos difíciles, 49:40–49:56. Paráfrasis del HTML.

## 07. Ocho imágenes empiezan a fallar al seguir entrenando

**Acción en pantalla.** T1. Pulsar Investigar 15 a 20, visible en la barra superior incluso con una imagen fijada. También se puede activar Comparar dos épocas, referencia A época 15 y miniatura B época 20.

**Evidencia que debe verse.** Conteos 6 corregidas, 8 nuevos errores, 20 errores persistentes y 966 aciertos persistentes.

**Qué decir.**

> Comparamos las predicciones de época 15 y 20 contra la etiqueta verdadera. Se corrigen seis imágenes, ocho empiezan a fallar y veinte siguen erradas. Por eso los errores de la muestra pasan de veintiséis a veintiocho. Las otras novecientas sesenta y seis permanecen correctas. Los cuatro grupos cubren exactamente las mil imágenes. La media final por sí sola oculta estos cambios de identidad.

**Límite que hay que respetar.** El resultado se refiere a la cohorte visual. En las diez mil imágenes de prueba la exactitud pasa de 97,62% a 97,80%. No concluimos que entrenar más empeore siempre el modelo.

**Rúbrica.** Insight temporal con conteos exhaustivos, T1

## 08. El mismo seis cambia de acierto a error

**Acción en pantalla.** En el comparador 15/20 elegir Empiezan a fallar. Buscar 1182 y pulsar Encuadrar imagen. Consultar historial, Vecinos por época y vecinos originales. Guardar evidencia si se desea.

**Evidencia que debe verse.** Predicción 6 en época 15 y 8 en época 20, etiqueta real 6. Un vecino conservado de seis.

**Qué decir.**

> El seis que vimos entre capas también explica uno de los nuevos errores. En época 15 el modelo acierta y en época 20 predice ocho. Conserva solo uno de sus seis vecinos originales de la capa 4. Antes cinco vecinos eran seises y uno era ocho. Al final los seis son ochos. La herramienta conecta la transición de clasificación con el historial y con las imágenes reales de sus vecinos.

**Límite que hay que respetar.** Un cambio de vecindario acompaña el cambio de predicción, pero no establece causalidad.

**Rúbrica.** Vinculación de T1 con T2 y evidencia por identidad

## 09. El cinco #1393 mantiene un error difícil

**Acción en pantalla.** T1, época 20, desactivar Comparar dos épocas. En la matriz de confusión, pulsar la celda de clase real 5 y clase predicha 3. Buscar ID 1393.

**Evidencia que debe verse.** Tres imágenes en la confusión 5/3, el dígito 1393, historial de predicción y vecinos originales.

**Qué decir.**

> También encontramos errores que no desaparecen con el progreso global. La celda de cinco predicho como tres contiene tres imágenes de la muestra. En la imagen 1393, la predicción es tres desde la época 1 hasta la 20. Al inspeccionar sus seis vecinos finales, todos pertenecen a la clase tres. Revisamos su forma y su contexto, conservando el caso en el análisis.

**Límite que hay que respetar.** Una forma ambigua no demuestra que la etiqueta sea incorrecta.

**Rúbrica.** Diagnóstico, patrones persistentes y detalles a demanda

**Conexión con la clase.** Confusión 3/5 con recuperación de la imagen, 41:04–41:25. Investigar los casos difíciles antes de eliminarlos, 49:40–49:56. Paráfrasis del HTML.

## 10. El mantra organiza la investigación

**Acción en pantalla.** Limpiar filtros y selección. Mostrar el conjunto. Filtrar clases 6 y 8 y pulsar Encuadrar filtro. Activar Seleccionar y arrastrar una región. Revisar galería e inspeccionar una imagen.

**Evidencia que debe verse.** Overview, filtro/zoom y detalle, con mapa estable y galería de selección.

**Qué decir.**

> El recorrido empieza con toda la cohorte. Después reducimos la pregunta con clases, errores, zoom o selección de una región. Finalmente recuperamos imágenes, predicciones, historial y vecinos originales. Hover permite explorar sin atenuar el conjunto. Clic fija el caso. En T2 podemos recorrer capas mediante animación o compararlas estáticamente.

**Límite que hay que respetar.** Filtrar conserva las coordenadas y una referencia tenue del conjunto.

**Rúbrica.** Mantra, interacción, animación y claridad

**Conexión con la clase.** Recorrido global hacia ejemplos individuales, 1:04:34–1:04:52. Paráfrasis de la guía HTML.

## 11. Qué permiten afirmar las visualizaciones

**Acción en pantalla.** Abrir Método y fuentes para revisar modelo, muestra, proyección y límites. En una selección, comparar Agrupamiento al 0% con un valor superior.

**Evidencia que debe verse.** Diferencia entre posiciones medidas y dibujo de las conexiones, datos del experimento y definiciones de métricas.

**Qué decir.**

> Usamos posición para similitud proyectada y color para clase verdadera. Las miniaturas y la comparación estática complementan la animación. AlignedUMAP enlaza los mismos IDs y reduce saltos entre estados. La alineación también puede atenuar cambios. El agrupamiento modifica la forma de las curvas y usa etiquetas para ordenar el dibujo. Por eso defendemos hallazgos con predicciones, imágenes y vecinos originales, además de la proyección. T1 y T2 usan secuencias de proyección diferentes. El NH de la misma capa y época puede variar entre ambas porque depende de la proyección.

**Límite que hay que respetar.** NH es mezcla por clase, trustworthiness es preservación de vecindarios y exactitud evalúa la salida final. Ninguna curva demuestra causalidad.

**Rúbrica.** Justificación de colores, método, transiciones, layout y límites

**Conexión con la clase.** Estabilidad de las proyecciones, 45:24–46:12. Obtener conclusiones de la visualización, 54:26–55:54. Paráfrasis del HTML.

## 12. La mejora global convive con errores individuales

**Acción en pantalla.** Volver al caso 1182 o mantener la diapositiva de síntesis. Cerrar con la evidencia, no con una promesa de calificación.

**Evidencia que debe verse.** Separación temporal, refinamiento por capas y cambio de errores, resumidos con cifras de la misma cohorte.

**Qué decir.**

> La clase se separa mejor durante el entrenamiento y las capas refinan su organización. Aun así, algunas imágenes empiezan a fallar y otras conservan errores difíciles. El aporte de la visualización consiste en poder recorrer estas diferencias y comprobar cada caso. Cada conclusión de esta presentación se puede reconstruir con una época, una capa, un filtro o un ID en la herramienta.

**Límite que hay que respetar.** Un modelo, un dataset y una cohorte equilibrada. No generalizamos los hallazgos a todas las redes.

**Rúbrica.** Cierre con insights y evidencia reproducible

## 13. Rúbrica y evidencia observable

**Acción en pantalla.** Reserva para preguntas. Recorrer la matriz y abrir la evidencia correspondiente si el profesor la solicita.

**Evidencia que debe verse.** Los cuatro criterios recibidos: 4, 4, 4 y 8 puntos.

**Qué decir.**

> La validación organiza la evidencia disponible por criterio. No asignamos una nota: la decisión corresponde al profesor.

**Límite que hay que respetar.** El cumplimiento técnico y la evidencia no garantizan una calificación.

**Rúbrica.** Trazabilidad completa de la rúbrica

## 14. Datos, método y reproducción

**Acción en pantalla.** Reserva técnica. Abrir Método y fuentes o los archivos de datos y el código de entrenamiento.

**Evidencia que debe verse.** MNIST, particiones 50000/10000/10000, MLP, siete checkpoints, 1000 IDs y fuentes científicas.

**Qué decir.**

> El experimento entrena un MLP de cuatro capas ocultas de 128 unidades con ReLU y Adam. La semilla es 42. Conservamos entrenamiento, validación y prueba separados. Flask sirve datos precalculados y D3 construye la visualización. El proyecto incluye nodos, aristas de identidad, configuración y pruebas. La tarea permite asistencia de IA.

**Límite que hay que respetar.** Solo se implementa MNIST. No se reclama el beneficio opcional de varios datasets.

**Rúbrica.** Requerimientos técnicos y fuentes

## Validación de la rúbrica recibida

| Criterio | Máximo | Evidencia que se muestra | Demostración |
|---|---:|---|---|
| Claridad, interacción y animación | 4 | Clases consistentes, formas, leyendas, escala común, hover, clic, filtros y reproducción | Diapositivas 2, 3, 5 y 10; reproducir épocas/capas en la aplicación |
| Hallazgos analíticos | 4 | Formación de grupos, refinamiento por capas, cambios de errores y dos imágenes concretas | Diapositivas 3–9; buscar 1182 y 1393 |
| Justificación del diseño | 4 | Posición/color/forma, AlignedUMAP, comparación estática, detalle a demanda y límites | Diapositivas 2, 10 y 11; Método y fuentes |
| Cumplimiento de T1 y T2 | 8 | Capa fija al recorrer épocas y época fija al recorrer capas, correspondencias por ID | Diapositivas 3–8; miniaturas, Comparar y Recorrido |

Los máximos suman 20 puntos. Esta tabla documenta evidencia disponible; la calificación corresponde al profesor.

## Respuestas para preguntas frecuentes

**¿Qué son los ejes?** Dos dimensiones de una proyección de activaciones. No son píxeles ni neuronas concretas. La cercanía es una aproximación a relaciones multidimensionales.

**¿Por qué AlignedUMAP?** Relaciona los mismos IDs entre estados para regularizar su movimiento. La alineación facilita comparar, pero puede atenuar cambios y no elimina la distorsión. Es una decisión de implementación; el profesor no exigió específicamente AlignedUMAP.

**¿Los contornos delimitan la clase predicha?** No. Describen concentración estimada por clase verdadera en 2D. Los puntos aislados y las confusiones permanecen visibles.

**¿Cada capa predice un dígito distinto?** La predicción del inspector corresponde siempre a la salida final del modelo en la época activa. Las capas ocultas muestran representaciones y vecindarios, no clasificadores entrenados por capa.

**¿Por qué el seis tiene una puntuación cercana a 100% para ocho?** Es la salida softmax del modelo. Una puntuación alta puede acompañar un error y no demuestra calibración. La interfaz redondea los porcentajes.

**¿De dónde salen los vecinos?** De las activaciones originales, dentro de la cohorte visual fija de 1 000 imágenes. La proyección solo sitúa sus marcas en el mapa.

**¿Qué son las aristas?** Correspondencias entre estados consecutivos de la misma imagen. No son pesos entre neuronas ni una red social.

**¿Por qué suben los errores de la muestra y mejora la prueba completa?** Evalúan cohortes distintas. Entre épocas 15 y 20, la muestra pasa de 26 a 28 errores, mientras la prueba completa pasa de 97,62% a 97,80% de exactitud. No se intercambian denominadores.

**¿Se implementaron varios datasets?** Solo MNIST. No se reclama el beneficio opcional de más datasets.

## Fuentes

- Datos medidos: `static/data/dataset.json`, configuración en `static/data/manifest.json` y código de entrenamiento del proyecto.
- Recomendaciones del profesor: análisis exhaustivo HTML local `analisis_exhaustivo.html` de semana 12, clase 1. Los tiempos son referencias a la grabación y las formulaciones son paráfrasis.
- Rauber, Fadel, Falcão y Telea (2017), [Visualizing the Hidden Activity of Artificial Neural Networks](https://webspace.science.uu.nl/~telea001/VisualAnalytics/NNHidden), sección 5.4.
- [Documentación de AlignedUMAP](https://umap-learn.readthedocs.io/en/latest/aligned_umap_basic_usage.html).
- Rúbrica proporcionada en la conversación por el estudiante: 4 + 4 + 4 + 8.

Las transiciones animadas interpolan estados medidos. La forma de una curva, la separación visual o un cambio de vecindario no prueban causalidad.
