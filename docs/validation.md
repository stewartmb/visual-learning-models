# Validación de la versión 0.5.0

Fecha: 10 de noviembre de 2026. Entorno de cálculo: macOS, Apple M2 Pro, Python 3.12, CPU, semilla 42. Las versiones están en el manifiesto.

## Datos y servidor

Cuatro pruebas automatizadas verifican:

1. Cohorte fija, 100 imágenes por clase, estados finitos, siete épocas/cuatro capas, probabilidades y predicciones, vecinos sin autoenlaces y un único modelo en los datos distribuidos.
2. 56000 nodos y 45000 aristas, con IDs, secuencia y estados consecutivos correctos.
3. SHA-256 de todos los archivos de datos publicados.
4. Página, salud, datos, manifiesto y selección de secuencias; entradas inválidas devuelven 404.

Resultado: **4 pruebas aprobadas**.

## Geometría de trayectorias

Cuatro pruebas Node verifican extremos coincidentes, fuerza cero, ausencia de bucles en desplazamientos mínimos, los tres ejemplos de la auditoría y límites de desviación/avance sobre los 24000 segmentos temporales publicados con fuerza máxima. Las posiciones medidas no se modifican. Resultado: **4 pruebas aprobadas**.

## Interacción de navegador

Recorrido automatizado con Chromium/Playwright sobre la aplicación Flask:

- Cambiar capa y época modifica el estado y conserva 1000 observaciones.
- En época 0, el lienzo de trayectorias está vacío. En épocas 1 y 2 se añaden segmentos; regresar a 0 los elimina. El recorrido completo solo se dibuja al activar su opción. El control no aparece en T2.
- Filtrar una clase destaca 100 imágenes; los demás casos siguen como contexto gris tenue. Solo errores destaca 28 casos del modelo base en época 20. Ambos conservan diez referencias de clase, coordenadas y tamaño del mapa.
- «Limpiar filtros» permanece visible, se habilita con filtros y vuelve a deshabilitarse tras restablecerlos.
- Desactivar agrupamiento cambia el dibujo; el control de fuerza actualiza su valor.
- Atenuar el primer tramo cambia su dibujo de contexto; el control se oculta en T2 y no afecta el número de observaciones.
- Hover muestra imagen, etiqueta, predicción, principales puntuaciones, historial y seis vecinos sin cambiar opacidades ni el lienzo de curvas. Clic fija el caso y atenúa el resto; hover sobre otro caso no sustituye la selección fijada.
- Selección rectangular produce una galería paginada; zoom y restablecimiento funcionan.
- T2 muestra 4000 estados y 40 referencias de clase; adapta dos filas con orden explícito y permite inspeccionar una imagen por capa.
- Reproducción de épocas y revelado de capas pueden detenerse; el revelado se reanuda.
- La matriz muestra 100 celdas; seleccionar la confusión 5 → 3 recupera tres imágenes en época 20.
- Se distribuye un único modelo y no aparece un selector de experimentos.
- Diálogos de método y guía funcionan.
- T1 tiene siete miniaturas para elegir época; T2 usa su selector propio. El historial es de lectura. Controles e inspector ocupan columnas estables. El mapa supera 750 píxeles de altura en una ventana de 1512 × 1050; filtros, hover, selección, ajustes y diagnóstico no cambian su posición ni tamaño.
- Una imagen fijada fuera del filtro conserva el detalle con etiqueta explícita; su punto pasa al contexto y su curva no se dibuja.
- Anchura móvil de 390 píxeles sin desbordamiento global; controles superpuestos que no desplazan el mapa y capas en dos filas.

Resultado: **recorrido aprobado, sin errores JavaScript**. La revisión visual incluyó las vistas principales, detalle, selección, matrices y móvil.

El HTML sin conexión también se abrió directamente desde archivo y se comprobaron las dos tareas, época, capa y diagnóstico del único modelo. Resultado: **aprobado, sin errores JavaScript ni solicitudes HTTP externas**.

Las pruebas comprueban consistencia de la implementación, no prueban validez causal de una interpretación ni calidad perceptual universal de las proyecciones.


## Comparación y evidencia

Cuatro pruebas Node adicionales verifican las categorías contra la verdad (incluyendo error→otro error), las cifras 6/8/20/966 de épocas 15→20, la partición y reversión de las 49 parejas de épocas y las intersecciones de vecinos originales por ID. Resultado: 4 aprobadas.

El recorrido de descubrimiento comprueba activación manual y guiada, filtros combinados por clase, cero coincidencias, referencia A igual a B, conservación de posición/tamaño del mapa, extremos A/B medidos (tolerancia 0.001 píxeles por precisión de matrices SVG), vecinos conservados/nuevos y sus vínculos en las cuatro capas. La exportación se descarga y se comprueba que contiene PNG, muestra fijada, referencia y conteos verificables. El recorrido funciona también desde HTML offline sin solicitudes externas.

La densidad tiene un único nivel con parámetros fijos; no se interpreta como frontera, cobertura probabilística ni densidad en activaciones originales. Los límites de estas verificaciones siguen siendo consistencia de datos e implementación; no son un estudio de usabilidad ni una validación causal.


## Espacio y legibilidad

Verificación a 1512×1050, 1800×1050 y 1280×800: columnas de control legibles, curva de al menos 300×170 en escritorio y siempre arriba. Su posición no cambia al inspeccionar ni al desplazar el panel de detalles. Se comprueba igualdad de unidades X/Y y constancia de escala entre épocas 2 y 20, ocupación mayoritaria del ancho en época 2 y ausencia de cambios de época al consultar la curva. El encuadre explícito sigue incluyendo A y B.

También se verifica 772×1050: mapa de más de 700 píxeles de ancho, curva inferior visible y estable, controles superpuestos y cierre de detalle sin perder métricas ni desplazar el mapa.


## Reorganización entre capas 0.6.0

Resultado: 4 pruebas Python de integridad y 8 pruebas Node de transiciones y curvas aprobadas. Los recorridos de navegador de interfaz, descubrimiento, escritorio/tablet y capas pasan sin errores JavaScript. El nuevo recorrido también pasa abriendo directamente el HTML sin conexión.

La comprobación de T2 cubre overview limpio sin conexiones globales, 1000 IDs por capa, posiciones estables al filtrar, hover sin atenuación ni conexiones añadidas, trayectoria fijada hasta la capa activa, ausencia de segmentos antes de capa 1, persistencia de identidad al cambiar de capa y reproducción hasta la capa 4. La comparación A/B conserva los mismos 1000 IDs en cada mapa, unidades X/Y iguales y escala común entre paneles. Se comprueba énfasis enlazado, contraste de seis vecinos originales con la referencia elegida y metadatos de capas y vecinos en la evidencia descargada. El resumen agrupado usa un espacio compartido. A 390 píxeles los dos mapas se apilan sin desplazamiento horizontal.

Se revisaron capturas de Explorar, Comparar, Recorrido y el caso MNIST #1182, además del resultado en el navegador integrado a 772 píxeles. Estas comprobaciones verifican integridad y comportamiento, no constituyen un estudio de usabilidad.


## Hallazgos, rúbrica y exposición 0.7.0

La rúbrica recibida concentra 4 puntos en claridad/interacción/animación, 4 en insight, 4 en justificación y 8 en T1/T2. La guía de exposición describe una acción observable por afirmación. No se asigna una nota.

Se revisaron capturas de las vistas y catorce diapositivas. La revisión retiró conexiones globales del overview entre capas, conservó una comparación A/B sin cables, añadió búsqueda de IDs y dos filas de vecinos originales, e hizo que el encuadre de una imagen conserve referencias de su clase real y predicha. La matriz distingue las evaluaciones sobre 1000 y 10000 imágenes. La comparación directa mantiene conexiones A/B aunque se ocultaran anteriormente las trayectorias acumuladas.

El caso 1182 tiene vecinos de clases 6,8,6,8,6,9 en capa 1 y seis ochos desde capa 2, en época 20. La prueba de navegador verifica esas clases contra los datos originales. En épocas 15/20 de capa 4 pasa de predicción 6 a 8 y conserva un vecino de seis. El caso 1393 conserva predicción 3 desde época 1, con clase verdadera 5. Los cuatro grupos de transición suman 1000 y los conteos 6/8/20/966 corresponden a la muestra, independientemente de la mejora de prueba completa.

Las pruebas de integridad y los recorridos de navegador pasan en aplicación y HTML sin conexión. También se revisa la presentación sin conexión: 14 imágenes completas, navegación por teclado, notas y ausencia de solicitudes externas. Las cifras se contrastaron con el JSON del experimento. Las conclusiones siguen siendo descriptivas y no causales.
