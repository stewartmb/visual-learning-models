# Trazabilidad con la tarea entregada

La autoridad es `Tarea_Visual_Learning_Models.pdf`, proporcionado por el estudiante. La traducción fiel se conserva localmente. Los enunciados de otros repositorios no reemplazan esta versión.

| Requisito | Implementación / evidencia |
|---|---|
| T1: observaciones entre épocas | `t1-l0` a `t1-l3`, siete estados por secuencia, capa fija |
| T2: observaciones entre capas | `t2-e0` a `t2-e20`, cuatro estados por secuencia, época fija |
| Dataset de clasificación de imágenes | MNIST real, diez clases |
| Entrenar una ANN | MLP de cuatro capas ocultas, 20 épocas, `scripts/train.py` |
| Activaciones antes, durante y después | Checkpoints 0/1/2/5/10/15/20, mismos 1000 IDs de prueba |
| Reducción de dimensionalidad | AlignedUMAP; contraste t-SNE conjunto de la última capa |
| Scatterplots con color de clase verdadera | Puntos y dominio cromático fijo 0–9 |
| Evolución entre capas y épocas | Trayectorias agrupadas en ambas vistas, extremos medidos |
| Interacción y animación | Hover, click, brush, filtros, zoom, reproducción de épocas y transición animada entre capas |
| Mantra de visualización | Overview completo; zoom/filter; inspector y galería |
| D3; otras bibliotecas de visualización no permitidas | D3 7.9.0 local; marcas SVG y curvas Canvas organizadas con D3. Sin Plotly, Chart.js, matplotlib ni librerías de gráficos adicionales |
| Aplicación Flask | `app.py`, plantillas, API de datos y `/health` |
| Datos nodes y edges | CSV con identidades, estados y conexiones consecutivas; ver tests |
| ZIP único | Proyecto completo, datos precalculados y dependencias mínimas; sin necesidad de entrenar para abrirlo |
| Sustentación obligatoria | Guion de ocho minutos en `presentation-guide.md`; corresponde al estudiante exponer |
| Comparación con evidencia | Transiciones de predicciones medidas, comparación A/B de vecinos originales y HTML exportable con IDs |
| Justificación y conclusiones | Diseño, métricas de calidad y ejemplos que explican representaciones y errores |

## Ambigüedades conservadas

El PDF menciona colaboradores, puentes, medidas de redes y cuatro tareas, aunque define explícitamente dos tareas sobre representaciones neuronales. No se inventa un requisito de PageRank o una red social. Se cubren las dos tareas explícitas con preguntas de análisis sobre épocas, capas, confusiones y calidad de la proyección.

El paper define una T2 sobre neuronas; el enunciado define su T2 sobre capas. Se sigue el enunciado. El paper descarta animación masiva de puntos, mientras la tarea exige animación; se combina animación controlada con comparación estática.

Usar más de un dataset favorece la nota según el PDF. Esta versión usa solo MNIST por decisión del estudiante y no reclama ese beneficio. El guion no sustituye la exposición en clase ni garantiza calificación.
