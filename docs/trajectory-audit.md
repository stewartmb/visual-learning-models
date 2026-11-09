# Corrección de los desvíos artificiales · v0.1.2

La revisión de v0.1.1 encontró que atraer los controles sin límites hacia centroides creaba arcos grandes entre posiciones casi idénticas. El problema estaba en el dibujo; se conservaron las imágenes y todos sus estados medidos.

| Imagen | Capa | Épocas | Longitud anterior / distancia entre extremos | Longitud corregida / distancia |
|---|---:|---|---:|---:|
| MNIST #1393 | 4 | 1 → 2 | 642.05× | 1.053× |
| MNIST #2787 | 4 | 10 → 15 | 12.93× | 1.034× |
| MNIST #6071 | 2 | 10 → 15 | 220.93× | 1.087× |

Se muestreó cada Bézier en 81 puntos, usando las coordenadas exportadas y fuerza 0.45. Los cocientes describen geometría del dibujo, no aprendizaje ni fidelidad de la proyección.

La corrección mantiene los controles en 1/3 y 2/3 de la conexión longitudinal y limita su desviación perpendicular a 0.25 veces la distancia entre extremos. El avance longitudinal es monótono. Extremos coincidentes producen un recorrido nulo. Las dos tareas usan la misma función, `static/trails.js`.

La imagen #1393 sigue siendo útil como error persistente: su etiqueta es 5 y su predicción es 3 en los dos estados auditados. Eliminar su arco artificial no elimina la evidencia para diagnóstico. La imagen #2787 conserva predicción correcta y el conjunto de seis vecinos en el intervalo auditado; puede servir como referencia de estabilidad.

## Relevancia de la época 0

Es la red inicial sin entrenamiento y permite comparar el primer cambio respecto de esa referencia. El enunciado pide observar antes, durante y después del entrenamiento. Se conserva su estado y el segmento 0→1.

Para estudiar cambios tardíos puede resultar visualmente dominante. El nuevo control **Atenuar primer tramo (0→1)** reduce su opacidad de contexto sin eliminar observaciones ni relaciones. Seleccionar una imagen recupera el énfasis de su recorrido. La opción no supone que la transición inicial sea irrelevante.

La curva entre dos instantáneas es un recurso de conexión; no se midió la ruta continua de activaciones dentro de ese intervalo. Tampoco una proyección aparentemente estable garantiza que las activaciones originales no cambiaron.
