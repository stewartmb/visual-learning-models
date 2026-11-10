# Validación de la versión 0.3.0

Fecha: 9 de noviembre de 2026. Entorno de cálculo: macOS, Apple M2 Pro, Python 3.12, CPU, semilla 42. Las versiones están en el manifiesto.

## Datos y servidor

Cuatro pruebas automatizadas verifican:

1. Cohorte fija, 100 imágenes por clase, estados finitos, siete épocas/cuatro capas, probabilidades y predicciones, vecinos sin autoenlaces y misma red inicial entre experimentos.
2. 112000 nodos y 90000 aristas, con IDs, secuencia y estados consecutivos correctos.
3. SHA-256 de todos los archivos de datos publicados.
4. Página, salud, datos, manifiesto y selección de secuencias; entradas inválidas devuelven 404.

Resultado: **4 pruebas aprobadas**.

## Geometría de trayectorias

Cuatro pruebas Node verifican extremos coincidentes, fuerza cero, ausencia de bucles en desplazamientos mínimos, los tres ejemplos de la auditoría y límites de desviación/avance sobre los 48000 segmentos temporales publicados con fuerza máxima. Las posiciones medidas no se modifican. Resultado: **4 pruebas aprobadas**.

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
- Matrices muestran 200 celdas; seleccionar la confusión 5 → 3 recupera tres imágenes del modelo base en época 20.
- Cambiar de experimento actualiza correctamente el modelo seleccionado.
- Diálogos de método y guía funcionan.
- T1 tiene siete miniaturas para elegir época; T2 usa su selector propio. El historial es de lectura. Controles e inspector ocupan columnas estables. El mapa supera 750 píxeles de altura en una ventana de 1512 × 1050; filtros, hover, selección, ajustes y diagnóstico no cambian su posición ni tamaño.
- Una imagen fijada fuera del filtro conserva el detalle con etiqueta explícita; su punto pasa al contexto y su curva no se dibuja.
- Anchura móvil de 390 píxeles sin desbordamiento global; controles superpuestos que no desplazan el mapa y capas en dos filas.

Resultado: **recorrido aprobado, sin errores JavaScript**. La revisión visual incluyó las vistas principales, detalle, selección, matrices y móvil.

El HTML sin conexión también se abrió directamente desde archivo y se comprobaron las dos tareas, cambio de experimento, época y capa. Resultado: **aprobado, sin errores JavaScript ni solicitudes HTTP externas**.

Las pruebas comprueban consistencia de la implementación, no prueban validez causal de una interpretación ni calidad perceptual universal de las proyecciones.
