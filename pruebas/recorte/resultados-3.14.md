# Paso 3.14: recorte fuera del hilo principal (parte automatizable)

Fecha: 17-11-2026. Equipo: MacBook con Apple M1 (8 núcleos), Chrome 157 de escritorio,
contra `localhost:3100`. Modelo `isnet_quint8` en CPU, ya en la caché HTTP (no se mide la
descarga). Fotos: `pruebas-fotos/streetwear/` (PNG 1024×1024, se reducen a 1200 px como en la app).

## Decisión

**Worker: no.** El recorte sigue en el hilo principal, como estaba.

En `next dev` el Web Worker iba perfecto: el mismo tiempo por foto, cero bloqueo y una barra de
progreso fluida. Pero en el build de producción (`next build` + `next start`) la inferencia
dentro del worker tardaba unas 6 veces más: unos 60 s por foto frente a unos 9 s. Lo comprobé
alternando worker e hilo principal en el mismo build y la misma página. Como Vercel sirve el
build de producción, el worker habría hecho el recorte mucho más lento. No encontré la causa con
un esfuerzo razonable (ver "Qué se investigó").

Se mantiene un arreglo que salió de esta prueba: **el progreso del recorte nunca llegaba**.
`@imgly/background-removal` memoiza `init()` por `JSON.stringify(config)`, y el JSON no incluye
la función `progress`. Por eso todas las llamadas usaban el `progress` de la primera, que era la
precarga y descartaba las claves `compute:*`. La barra pasaba de 0 % a 100 % también por eso, no
solo por el bloqueo. Ahora `removeBackground.ts` pasa siempre a la librería el mismo relevo, y
este avisa al callback de la tarea en curso. Hoy, en el hilo principal, solo se notan los saltos
5 % → 95 % → 100 %, porque durante la inferencia no corre ningún temporizador. Con un worker
futuro, la barra estimada ya funcionaría.

## Tiempos y bloqueo, antes y después (`next dev`)

"Antes" es el hilo principal y "worker" es el prototipo con worker. "Bloqueo" sale de
`PerformanceObserver('longtask')` y de un `setInterval` de 100 ms que guarda el mayor retraso
entre ticks.

| Prueba | Camino | Tiempo por foto | Long tasks | Mayor retraso entre ticks | Valores de progreso distintos |
|---|---|---|---|---|---|
| `/dev/imaging`, 3 fotos | Hilo principal | 9,1 · 8,6 · 8,6 s | 4 (máx. 8,7 s; total 26,3 s) | **8,7 s** | 2 (0 % → 100 %) |
| `/dev/imaging`, 3 fotos | Worker | 9,2 · 8,6 · 8,7 s | 0 | **6 ms** | 97 |
| Cola (`/dev/queue`, lote), 3 fotos | Hilo principal | 9,4 · 8,7 · 8,6 s | 4 (máx. 8,7 s; total 26,2 s) | **8,6 s** | 2 |
| Cola (`/dev/queue`, lote), 3 fotos | Worker | 9,4 · 8,7 · 8,7 s | 0 | **2 ms** | 27–36 por foto |

La prueba con worker en `next dev` cumple lo que se buscaba: la página no se bloquea nada y el
tiempo por foto no cambia. El hilo principal se bloquea unos 8,7 s por foto en este M1. En un
móvil será bastante más.

## Producción (`next build` + `next start`, mismo build, alternando)

| Camino | Tiempo por foto |
|---|---|
| Worker | 60,6 · 58,6 · 60,5 · 60,1 · 58,8 · 59,2 s (`session.run` de onnxruntime solo: 60,7 s) |
| Hilo principal | 10,3 · 11,0 · 10,0 · 9,0 · 18,7 · 30,6 · 39,5 s |

- El worker en producción va siempre a ~60 s por foto. El mismo código en `next dev` va a 8,7 s
  (`session.run`: 8,7 s). La configuración de onnxruntime dentro del worker era la misma en los
  dos casos: `numThreads: 1`, `proxy: false`, `wasmPaths` como blobs de la CDN de img.ly y
  `crossOriginIsolated: false`.
- El hilo principal en producción suele ir a 9–11 s. Las tres medidas altas (18,7, 30,6 y
  39,5 s) coinciden con ratos en que la ventana de Chrome estaba en segundo plano: Chrome agrupa
  los temporizadores a 1 por segundo (huecos de 900 ms entre ticks sin long tasks) y probablemente
  baja la prioridad del proceso. El worker no bajó de 58 s en ninguna condición.

## Memoria con 10 fotos en cola (`next dev`, aproximada)

| Camino | Tiempo por foto | Heap JS de la página (`performance.memory`) | RSS del proceso renderer de la pestaña |
|---|---|---|---|
| Hilo principal | 8,7–9,5 s | máx. 136 MB | 222 → 815 MB |
| Worker | 8,7–9,1 s (88 s en total) | máx. 25 MB (no cuenta el heap del worker) | 356 → 839 MB |

`performance.memory` solo ve el heap del hilo principal, así que con el worker no sirve para
comparar. La medida útil es el RSS del renderer, tomado con `ps` cada segundo: unos 800 MB de
pico en los dos casos. El worker ni ahorra ni gasta más memoria. El runtime de ONNX y el modelo
pesan lo mismo estén donde estén.

## Qué se investigó

- **`config.proxyToWorker` de imgly 1.7:** no sirve para CPU. El código hace
  `proxyToWorker = useWebGPU && config.proxyToWorker`, así que solo se aplica con GPU, y la GPU no
  funciona con esta librería (architecture.md 8).
- **imgly dentro de un worker:** funciona sin cambios. Usa `createImageBitmap`, `OffscreenCanvas`
  (con respaldo a `document` solo si no existe), `fetch` y wasm.
- **Turbopack (Next 16.4.6):** `new Worker(new URL('./cutout.worker.ts', import.meta.url),
  { type: 'module' })` se empaqueta en `dev` y en `build` sin configuración. Genera un arranque
  `turbopack-worker-*.js#params=…` que carga los chunks con `importScripts`. Además deja una copia
  del `.ts` fuente en `.next/static/media/`, que nadie usa.
- **Causa de la lentitud en producción:** no encontrada. Lo descartado: la configuración de ORT
  (la misma), la memoización de imgly, la descarga del modelo (está fuera del `session.run`
  medido) y la versión de onnxruntime (1.21.0 en los dos). La hipótesis que queda: algo del
  arranque de workers de Turbopack en producción hace que V8 ejecute el wasm sin optimizar
  (Liftoff sin pasar a TurboFan), o que macOS dé a ese hilo menos prioridad. No pude comprobarlo
  sin DevTools.
- **Si se quiere retomar:** probar `next build --webpack` solo para comparar; un worker propio
  servido como archivo estático que cargue imgly/ORT sin pasar por Turbopack; o repetir la prueba
  con una versión nueva de Next. El prototipo con fallback al hilo principal, tests con un Worker
  falso y el mismo protocolo de progreso quedó descrito en el informe del paso 3.14. No se ha
  guardado en el repo.

## COOP/COEP

**No se han activado** (el plan, 3.14, dice que solo se prueban si en el móvil es inaceptable).
Con `Cross-Origin-Opener-Policy: same-origin` y `Cross-Origin-Embedder-Policy: require-corp`
habría `crossOriginIsolated` → `SharedArrayBuffer` → ORT con varios hilos de wasm (hoy usa 1).
Riesgos ya anotados en el plan: con COEP, todas las imágenes de otro origen (URLs firmadas de
Supabase) necesitan `crossorigin="anonymous"` y que el bucket responda con CORS, y hay que
comprobar que Konva puede exportar sin "lienzo contaminado". También habría que ver si cambia
el comportamiento del worker y de la CDN de img.ly (que tendría que responder con CORP/CORS).

## Pendiente: medir en móvil real (John)

Desde la preview de Vercel (build de producción), en un **Android de gama media** y en un
**iPhone**:

1. Descarga del modelo la primera vez (tiempo hasta que aparece "Quitando el fondo…").
2. Tiempo por foto (3 fotos, se ve en `/dev/imaging`).
3. Cuánto se congela la interfaz durante el recorte: intentar hacer scroll y escribir en el
   formulario de la prenda mientras se recorta (spec 3.1 / screens 5.3). Hoy se congela durante
   toda la inferencia.
4. Memoria y estabilidad con 10 fotos en cola: ¿la pestaña se recarga o se cierra?
5. Bloquear la pantalla y cambiar de app a mitad: ¿se pausa y sigue?
6. Si sale > 60 s por foto, cierres por memoria o una interfaz que no se puede usar: decidir
   entre COOP/COEP (en una preview aparte), retomar el worker (ver arriba) o el plan B en servidor.
