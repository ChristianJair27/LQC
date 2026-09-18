/**
 * capturas.mjs — hoja de contactos ANTES/DESPUÉS para revisar cambios de UI MIRANDO.
 *
 * Nació de un caso concreto: un día el build, el lint, los contrastes y la geometría
 * daban todos verde, y la copa de fondo estaba cortada por el borde. Ningún número lo
 * detectó porque ningún número podía: la verificación de entonces metía cada
 * `page.screenshot()` en un Buffer, lo convertía en estadísticas y lo tiraba. Nunca hubo
 * una imagen que un humano pudiera abrir. Esto arregla eso: las capturas se guardan en
 * disco y terminan en una hoja de contactos que se abre en el navegador.
 *
 * Uso:
 *   npm run capturas              # árbol de trabajo contra HEAD
 *   npm run capturas -- HEAD~3    # árbol de trabajo contra otro commit
 *   npm run capturas -- --no-abrir
 *
 * Cómo funciona: construye los dos lados —el «antes» en un `git worktree` aparte, para no
 * ensuciar el árbol de trabajo—, los sirve a la vez en dos puertos y los recorre con un
 * solo Chrome. Sale una hoja en capturas/index.html.
 *
 * TRES REGLAS QUE NO SON NEGOCIABLES, cada una pagada con un día de depuración:
 *
 *   1. NUNCA se guardan imágenes «golden» de referencia. El antes y el después se generan
 *      SIEMPRE juntos, en la misma corrida y con el mismo Chrome. El navegador se
 *      autoactualiza y cambia cómo antialiasea; una referencia guardada hace tres semanas
 *      compara dos Chromes distintos y el diff se llena de falsos positivos que parecen
 *      bugs. Si alguna vez tenés ganas de cachear el lado «antes» para ahorrar ocho
 *      segundos de build: no. Ocho segundos son más baratos que una tarde persiguiendo un
 *      cambio que nunca existió.
 *
 *   2. El sondeo de red se congela ANTES de capturar. La página de torneos consulta ATAK
 *      en intervalos; si la respuesta llega entre una captura y la siguiente, la página
 *      repinta sola y el diff reporta un cambio que no causó tu código. Ver `congelarRed`.
 *
 *   3. El piso de ruido se MIDE, no se supone. Dos capturas idénticas de la misma página
 *      ya difieren en algunos píxeles (compresión, subpíxel, GPU). Por eso de cada ruta se
 *      toman TRES fotos: dos del «antes» —que dan el ruido de base— y una del «después».
 *      El umbral para declarar un cambio real sale de esa medición, no de una constante
 *      inventada. Ver `UMBRAL_PIXELES` y `UMBRAL_DELTA`.
 */

import { spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SALIDA = path.join(RAIZ, 'capturas')

/* Las 8 rutas públicas, SIEMPRE las 8. Se evaluó derivarlas del diff (qué archivos
   cambiaron -> qué páginas los importan) y se descartó a propósito: con 8 páginas la
   corrida entera tarda unos minutos, y la derivación tiene dos puntos ciegos que
   no se tapan con un grafo de imports —la cascada de CSS, y los textos estáticos de
   index.html, que no los importa nadie—. Barrer todo es más barato que equivocarse en qué
   barrer. /admin queda afuera: está tras login y no es UI pública. */
const RUTAS = ['/', '/torneos', '/galeria', '/acerca', '/contacto', '/registro', '/carta', '/reglamento']

/* Escritorio y teléfono. deviceScaleFactor 1: queremos píxeles CSS, no retina. */
const ANCHOS = [
  { nombre: 'escritorio', width: 1440, height: 900 },
  { nombre: 'telefono', width: 375, height: 812 },
]

/* Piso mínimo para declarar que una fila de píxeles cambió de verdad. Si la medición de
   ruido de la corrida sale por encima de esto, mandan los valores medidos. */
const UMBRAL_PIXELES = 20 // píxeles distintos en la fila
const UMBRAL_DELTA = 5 // suma de |dR|+|dG|+|dB| del píxel más distinto de la fila

const PUERTOS = { antes: 18491, despues: 18492, hoja: 18493 }

/* Un único «ahora» para toda la corrida: es lo que se le inyecta a las dos páginas para que
   el reloj del encabezado no se mueva entre el antes y el después. Ver `addInitScript`. */
const AHORA = Date.now()

/* Lo mismo para la temperatura de la tira: una sola respuesta de Open-Meteo por corrida,
   compartida por los dos anchos. Una por URL y no una sola: si el cambio en revisión toca la
   consulta de src/lib/clima.ts, el «después» tiene que recibir SU respuesta y no la del
   «antes», o una regresión real quedaría tapada. Ver `ctx.route` en el recorrido. */
const climaPorUrl = new Map()

const log = (...a) => console.log(...a)

/* OJO: esto LANZA, no llama a `process.exit`. Parece un detalle y no lo es: `process.exit`
   se salta los bloques `finally`, así que la versión anterior —que salía acá mismo— dejaba
   tirados el worktree, la junction al `node_modules` del repo y la copia del `.env` cada vez
   que fallaba un build. Y no era un caso raro: la junction fija el `node_modules` de HOY, o
   sea que `npm run capturas -- HEAD~3` contra un commit con otras dependencias falla por
   diseño. La salida con código 1 la hace `main()` DESPUÉS de limpiar. */
class ErrorCapturas extends Error {}
const fallar = (msg) => {
  throw new ErrorCapturas(msg)
}

/* ------------------------------- git ------------------------------- */

function git(args, cwd = RAIZ) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (r.status !== 0) fallar('git ' + args.join(' ') + ' falló:\n' + (r.stderr || r.stdout))
  return (r.stdout || '').trim()
}

/* Los .env NO están en git, así que `git worktree add` —que solo saca archivos versionados—
   deja el lado «antes» sin credenciales. Eso no es un detalle: la primera corrida de esta
   herramienta reportó /galeria como un cambio enorme, y lo que pasaba era que el «antes»
   construía sin `VITE_SUPABASE_*` y la página caía a su estado de error, mientras el
   «después» traía las fotos reales. El diff no comparaba código, comparaba entornos.
   Se copia el .env ACTUAL a los dos lados a propósito: lo que queremos aislar es el cambio
   de código, manteniendo el entorno constante. */
function copiarEntorno(destino) {
  const copiados = []
  for (const nombre of ['.env', '.env.local', '.env.production', '.env.production.local']) {
    const origen = path.join(RAIZ, nombre)
    if (fs.existsSync(origen)) {
      fs.copyFileSync(origen, path.join(destino, nombre))
      copiados.push(nombre)
    }
  }
  return copiados
}

function construir(cwd, etiqueta) {
  log('[capturas] construyendo ' + etiqueta + '...')
  const t = Date.now()
  const r = spawnSync('npm', ['run', 'build'], { cwd, encoding: 'utf8', shell: true })
  if (r.status !== 0) fallar('el build de ' + etiqueta + ' falló:\n' + ((r.stdout || '') + (r.stderr || '')))
  /* El aviso `[LQC]` de vite.config.ts sale por stdout y acá lo estábamos tragando. Si un
     lado construye sin variables y el otro no, la comparación entera queda envenenada: hay
     que verlo. */
  if (((r.stdout || '') + (r.stderr || '')).includes('[LQC] Aviso')) {
    log('[capturas]   OJO: ' + etiqueta + ' se construyó SIN variables de entorno.')
  }
  log('[capturas]   ' + etiqueta + ' listo en ' + ((Date.now() - t) / 1000).toFixed(1) + 's')
}

/* ------------------------- servidor estático ------------------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

/* Réplica deliberada del nginx de producción: `try_files $uri /index.html`, y NUNCA
   `$uri/`. AGENTS.md documenta por qué —con `$uri/`, una carpeta de public/ que se llama
   igual que una ruta (galeria/) se lleva puesta a la ruta con un 301 y después un 403—. Si
   el servidor de acá fuera más permisivo que producción, la hoja diría que una ruta está
   bien cuando en el server real da 403. */
function servirEstatico(raiz, puerto) {
  const srv = createServer((req, res) => {
    const limpia = decodeURIComponent((req.url || '/').split('?')[0])
    const destino = path.join(raiz, path.normalize(limpia).replace(/^[/\\]+/, ''))
    if (!destino.startsWith(raiz)) {
      res.writeHead(403).end('403')
      return
    }
    let archivo = null
    if (fs.existsSync(destino) && fs.statSync(destino).isFile()) archivo = destino
    else if (fs.existsSync(path.join(raiz, 'index.html'))) archivo = path.join(raiz, 'index.html')
    if (!archivo) {
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' }).end('<!doctype html><title>vacio</title>')
      return
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(archivo).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store',
    })
    fs.createReadStream(archivo).pipe(res)
  })
  return new Promise((resolver, rechazar) => {
    srv.on('error', (e) =>
      rechazar(
        e.code === 'EADDRINUSE'
          ? new ErrorCapturas('el puerto ' + puerto + ' está ocupado. ¿Hay otra corrida de `npm run capturas` viva? Esperá a que termine: dos corridas a la vez se pisan la carpeta capturas/ y el dist/.')
          : e,
      ),
    )
    srv.listen(puerto, '127.0.0.1', () =>
      resolver({
        url: 'http://127.0.0.1:' + puerto,
        /* `closeAllConnections` antes de `close`: Chrome deja sockets keep-alive abiertos y
           `srv.close()` no resuelve hasta que se cierren, así que sin esto la limpieza se
           colgaba justo antes de soltar el worktree. */
        cerrar: () =>
          new Promise((r) => {
            srv.closeAllConnections?.()
            srv.close(r)
          }),
      }),
    )
  })
}

/* ------------------------------ captura ------------------------------ */

/* REGLA 2. Se congela DESPUÉS de que la página cargó sus datos, no antes: si esto corriera
   en un init script, /torneos saldría sin su tabla y estaríamos comparando dos páginas
   vacías. Lo que se corta es el repintado posterior, no la carga. */
const congelarRed = () => {
  window.fetch = () => new Promise(() => {})
  const XHR = window.XMLHttpRequest
  if (XHR) {
    window.XMLHttpRequest = class extends XHR {
      send() {}
    }
  }
}

/* Las rutas son `React.lazy`, así que cuando se dispara `load` el body todavía está VACÍO:
   lo único montado es el spinner del Suspense, que no tiene texto. Sin esta compuerta las
   capturas salían en blanco o a medio pintar, y el paseo de imágenes recorría una página de
   900px de alto que después crecía a 3000. Se espera a que aparezca texto —el spinner no
   tiene, así que no da falsos positivos— y luego a que el alto deje de moverse. */
async function esperarAppRenderizada(page) {
  await page.waitForFunction(() => document.body && document.body.innerText.trim().length > 0, null, {
    timeout: 25000,
    polling: 100,
  })
  await page.waitForFunction(
    () => {
      const h = document.body.scrollHeight
      if (window.__altoPrevio === h) window.__vecesEstable = (window.__vecesEstable || 0) + 1
      else {
        window.__vecesEstable = 0
        window.__altoPrevio = h
      }
      return window.__vecesEstable >= 3
    },
    null,
    { timeout: 20000, polling: 150 },
  )
}

/* Corta cualquier espera que se pase de la cuenta. Sin esto, una sola página que no
   termina de asentarse cuelga la corrida entera: pasó en /carta la primera vez que se
   corrió esto, y como `page.evaluate` no respeta los timeouts de Playwright, el proceso se
   quedó quince minutos sin avanzar ni fallar. */
const conLimite = (promesa, ms, que) => {
  let reloj
  return Promise.race([
    promesa,
    new Promise((_, rechazar) => {
      reloj = setTimeout(() => rechazar(new Error(que + ' se pasó de ' + ms / 1000 + 's')), ms)
    }),
    /* `clearTimeout` no es cosmético: un `setTimeout` pendiente mantiene vivo el bucle de
       eventos de Node. Sin esto, el proceso seguía corriendo hasta tres minutos DESPUÉS de
       haber escrito la hoja, sin hacer nada, y esos minutos muertos se leían como si la
       herramienta fuera lentísima. */
  ]).finally(() => clearTimeout(reloj))
}

/* Espera a que las imágenes que VAN A SALIR EN LA FOTO terminen de bajar. Se repite hasta
   que la cuenta se estabiliza en vez de mirar una sola vez, porque una imagen que todavía
   está bajando no está «completa» y capturarla a medias produce una diferencia que no
   existe en el código. Qué imágenes cuentan y por qué se fuerzan a `eager`: ver
   `__imagenesEnCaptura` en el contexto.
   Los dos bucles tienen tope de vueltas a propósito: se ejecutan DENTRO de la página, y ahí
   un `while` que no termina no lo salva ningún timeout de afuera. */
async function asentarImagenes(page) {
  let previo = -1
  /* Dos vueltas y no cinco: desde que el `IntersectionObserver` se reemplaza por uno que
     declara todo visible, las imágenes ya no dependen de que el scroll pase por encima, así
     que el paseo pasó de ser el mecanismo a ser una red de seguridad. Con cinco vueltas de
     paseo largo, tres celdas se pasaban del tope de 180s y la corrida entera se iba a más de
     quince minutos. */
  for (let vuelta = 0; vuelta < 2; vuelta++) {
    const estado = await conLimite(
      page.evaluate(async () => {
        for (const img of window.__imagenesEnCaptura()) if (img.loading === 'lazy') img.loading = 'eager'
        const paso = Math.max(400, Math.round(window.innerHeight * 1.5))
        const TOPE = 40
        for (let i = 0; i < TOPE; i++) {
          const y = i * paso
          if (y > document.body.scrollHeight) break
          window.scrollTo(0, y)
          await new Promise((r) => setTimeout(r, 40))
        }
        window.scrollTo(0, 0)
        await new Promise((r) => setTimeout(r, 80))
        const imgs = window.__imagenesEnCaptura()
        return { total: imgs.length, completas: imgs.filter((i) => i.complete && i.naturalWidth > 0).length }
      }),
      45000,
      'el paseo para cargar imágenes',
    )
    /* Esperar a que las que salen en la foto terminen de bajar. El presupuesto escala con
       su cantidad. Cuando ni así terminan, no se disimula: el recuento final de abajo lo
       reporta y la celda sale marcada como no confiable. */
    const presupuesto = Math.min(55000, 15000 + estado.total * 100)
    await page
      .waitForFunction(() => window.__imagenesEnCaptura().every((i) => i.complete), null, { timeout: presupuesto, polling: 250 })
      .catch(() => {})
    /* Estable = ya no aparecen imágenes nuevas Y todas las que hay terminaron. */
    if (estado.total === estado.completas && estado.total === previo) break
    previo = estado.total
  }
  /* NO se fuerza `img.decode()` acá, y parece que faltara. Se probó el 2026-09-17: el
     revisor vio en una reproducción aparte una foto de /galeria salir como rectángulo liso
     con `complete: true`, y propuso esperar la decodificación. En ESTE pipeline hizo lo
     contrario de lo buscado: la misma foto salía con dos remuestreos distintos entre cargas
     (90 070 px en la galería de teléfono, 287 en el logo del pie), con o sin
     `decoding = 'sync'`. Sin él, ruido 0 en esas dos celdas y ninguna foto vacía en seis
     cargas revisadas. Si alguna vez ves un rectángulo liso con el recuento en 0, esa es la
     hipótesis a retomar, pero medí antes de volver a meterlo. */
  /* Recuento final HONESTO. Si algo quedó colgando, quien llama tiene que decirlo en la
     hoja: rendirse en silencio y fotografiar igual fue exactamente el bug que produjo una
     comparación inventada en /galeria. */
  return page.evaluate(() => {
    const imgs = window.__imagenesEnCaptura()
    return { total: imgs.length, pendientes: imgs.filter((i) => !i.complete).length }
  })
}

/* Red de seguridad para lo que `prefers-reduced-motion` no alcance (ver `reducedMotion` en
   el contexto, que es lo que de verdad hace determinista el fondo). Las transiciones se
   apagan para no capturar un estado a mitad de camino, y a las animaciones que sigan vivas
   se les fija el reloj: las finitas quedan en su fotograma final y las infinitas en una
   fase fija. Lo que importa no es qué fotograma, sino que sea el MISMO en los dos lados. */
async function fijarAnimaciones(page) {
  await page.addStyleTag({
    content:
      '*,*::before,*::after{transition:none !important;caret-color:transparent !important}' +
      /* El interior de un documento embebido lo pinta un plugin del navegador cuando se le
         da la gana, y no hay evento que avise. En /reglamento eso hacía que el visor de PDF
         saliera gris en una carga y azul en la siguiente: un cambio enorme y fantasma, con
         un piso de ruido de 228px que se comía cualquier cambio real de esa página.
         `visibility:hidden` apaga el pintado PERO conserva la caja, así que el marco, el
         tamaño y la posición del visor —que sí son nuestra UI y sí pueden romperse— se
         siguen comparando. Lo que dejamos de mirar es el contenido del PDF, que no es UI
         nuestra. */
      'object[type="application/pdf"],embed[type="application/pdf"]{visibility:hidden !important}',
  })
  await page.evaluate(() => {
    document.getAnimations().forEach((a) => {
      try {
        a.currentTime = 10000
        a.pause()
      } catch {
        /* animación ya terminada o sin línea de tiempo */
      }
    })
  })
}

async function prepararYCapturar(page, url, destino) {
  /* `load` y no `networkidle`: esta app sondea ATAK en intervalos, así que la red nunca se
     queda quieta los 500 ms que `networkidle` exige y la espera se iba siempre al timeout.
     El asentado real lo hacen los pasos de abajo, que sí sabemos qué esperan. */
  await page.goto(url, { waitUntil: 'load' })
  await esperarAppRenderizada(page)
  await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {})
  /* La primera carga de la corrida es la que dispara la consulta real a Open-Meteo, que
     puede tardar hasta 7s: sin esto, la temperatura podía llegar después de la foto del
     primer «antes» y faltar solo ahí. */
  await Promise.all(climaPorUrl.values())
  /* `.then(() => true)`: `document.fonts.ready` resuelve con el FontFaceSet, que Playwright
     no puede serializar de vuelta a Node. Devolver un booleano evita el error. */
  await conLimite(page.evaluate(() => document.fonts.ready.then(() => true)), 15000, 'la carga de fuentes').catch(() => {})
  const imagenes = await asentarImagenes(page)
  await page.evaluate(congelarRed)
  await fijarAnimaciones(page)
  await page.waitForTimeout(250)
  await page.screenshot({ path: destino, fullPage: true, timeout: 60000 })
  return imagenes
}

/* -------------------------------- diff -------------------------------- */

/* El diff corre DENTRO de Chrome, sobre canvas. La alternativa —decodificar el PNG a mano
   en Node— funciona, pero una página de 1440x6000 son 8,6 millones de píxeles por imagen y
   el des-filtrado en JS puro tarda cerca de un segundo por captura; por 48 capturas es un
   minuto extra regalado. Chrome ya está abierto y decodifica en nativo. */
const DIFF_EN_PAGINA = async ([urlA, urlB]) => {
  const carga = (u) =>
    new Promise((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = rej
      i.src = u
    })
  const [a, b] = await Promise.all([carga(urlA), carga(urlB)])
  const w = Math.min(a.naturalWidth, b.naturalWidth)
  const h = Math.min(a.naturalHeight, b.naturalHeight, 16384) // tope de canvas de Chrome
  const datos = (img) => {
    const c = new OffscreenCanvas(w, h)
    const cx = c.getContext('2d', { willReadFrequently: true })
    cx.drawImage(img, 0, 0)
    return cx.getImageData(0, 0, w, h).data
  }
  const pa = datos(a)
  const pb = datos(b)
  let maxPix = 0
  let maxDelta = 0
  const filas = []
  for (let y = 0; y < h; y++) {
    let n = 0
    let mx = 0
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const d =
        Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2])
      if (d > 0) {
        n++
        if (d > mx) mx = d
      }
    }
    if (n > 0) {
      filas.push({ y, n, mx })
      if (n > maxPix) maxPix = n
      if (mx > maxDelta) maxDelta = mx
    }
  }
  return {
    filas,
    maxPix,
    maxDelta,
    totalPix: filas.reduce((s, f) => s + f.n, 0),
    altoA: a.naturalHeight,
    altoB: b.naturalHeight,
    /* El ancho también, porque el diff compara solo hasta el menor de los dos y una columna
       de más se recortaría sin dejar rastro. Un desborde horizontal es exactamente la clase
       de bug que motivó esta herramienta. */
    anchoA: a.naturalWidth,
    anchoB: b.naturalWidth,
    truncado: h < Math.min(a.naturalHeight, b.naturalHeight),
  }
}

/* -------------------------- hoja de contactos -------------------------- */

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

function escribirHoja(celdas, meta) {
  const tarjetas = ANCHOS.map((vp) => {
    const delAncho = celdas.filter((c) => c.vp === vp.nombre)
    const cuerpo = delAncho
      .map((c, i) => {
        const id = vp.nombre + '-' + i
        const clase = c.veredicto === 'cambia' ? 'cambia' : c.veredicto === 'igual' ? 'igual' : 'error'
        return [
          '<section class="tarjeta">',
          '  <header><b>' + esc(c.ruta) + '</b><span class="chip ' + clase + '">' + esc(c.resumen) + '</span>',
          '  <label class="sup"><input type="checkbox" onchange="sup(\'' + id + '\',this.checked)"> superponer</label>',
          '  <input class="rango" id="r-' + id + '" type="range" min="0" max="100" value="50" oninput="op(\'' + id + '\',this.value)" disabled></header>',
          '  <div class="par" id="p-' + id + '">',
          '    <figure><figcaption>antes</figcaption><img loading="lazy" src="' + esc(c.archivoAntes) + '"></figure>',
          '    <figure><figcaption>después</figcaption><img loading="lazy" src="' + esc(c.archivoDespues) + '"></figure>',
          '  </div>',
          '</section>',
        ].join('\n')
      })
      .join('\n')
    return '<h2>' + esc(vp.nombre) + ' — ' + vp.width + 'px</h2>\n' + cuerpo
  }).join('\n')

  const estilo = [
    ':root{--fondo:#0a0a0f;--azul:#0066ff;--acento:#00d4ff;--texto:#e6e8ef;--tenue:#9aa3b2;--linea:#1e2330}',
    '*{box-sizing:border-box}',
    'body{margin:0;background:var(--fondo);color:var(--texto);font:15px/1.5 system-ui,Segoe UI,sans-serif;padding:24px}',
    'h1{font-size:22px;margin:0 0 4px}',
    'h2{font-size:15px;text-transform:uppercase;letter-spacing:.09em;color:var(--acento);margin:36px 0 12px;border-bottom:1px solid var(--linea);padding-bottom:6px}',
    '.meta{color:var(--tenue);font-size:13px;margin-bottom:8px}',
    '.aviso{border-left:3px solid var(--azul);padding:8px 12px;margin:16px 0;color:var(--tenue);font-size:13px;background:#0d1220}',
    '.tarjeta{border:1px solid var(--linea);border-radius:8px;margin-bottom:18px;overflow:hidden;background:#0c0f18}',
    '.tarjeta header{display:flex;align-items:center;gap:12px;padding:10px 14px;background:#111623;flex-wrap:wrap}',
    '.chip{font-size:12px;padding:2px 9px;border-radius:99px;font-weight:600}',
    '.chip.cambia{background:#0066ff;color:#fff}.chip.igual{background:#1b2436;color:var(--tenue)}.chip.error{background:#7a1d1d;color:#ffd7d7}',
    '.sup{font-size:12px;color:var(--tenue);margin-left:auto;display:flex;align-items:center;gap:5px}',
    '.rango{width:150px}',
    '.par{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:12px;align-items:start}',
    '.par.superpuesto{display:block;position:relative}',
    '.par.superpuesto figure:last-child{position:absolute;inset:12px;margin:0}',
    '.par.superpuesto figcaption{display:none}',
    'figure{margin:0}',
    'figcaption{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--tenue);margin-bottom:5px}',
    'img{width:100%;display:block;border:1px solid var(--linea);background:#000}',
  ].join('\n')

  const guion = [
    "function sup(id,on){document.getElementById('p-'+id).classList.toggle('superpuesto',on);var r=document.getElementById('r-'+id);r.disabled=!on;if(on)op(id,r.value)}",
    "function op(id,v){var f=document.querySelectorAll('#p-'+id+' figure');if(f[1])f[1].style.opacity=v/100}",
  ].join('\n')

  const html = [
    '<!doctype html><html lang="es"><meta charset="utf-8">',
    '<title>Capturas antes/después — LQC</title>',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<style>' + estilo + '</style>',
    '<h1>Capturas antes/después</h1>',
    '<p class="meta">antes = <code>' + esc(meta.base) + '</code> · después = ' + esc(meta.despues) + ' · ' + esc(meta.fecha) + ' · Chrome ' + esc(meta.chrome) + '</p>',
    '<div class="aviso">Las dos columnas se generaron en esta misma corrida, con el mismo Chrome. No hay imágenes de referencia guardadas: si volvés a correrlo, se rehacen las dos.<br>Piso de ruido medido en esta corrida: ' + esc(meta.ruido) + '.</div>',
    tarjetas,
    '<script>' + guion + '</script>',
    '</html>',
  ].join('\n')
  fs.writeFileSync(path.join(SALIDA, 'index.html'), html)
}

/* ------------------------------ principal ------------------------------ */

const args = process.argv.slice(2)
const abrir = !args.includes('--no-abrir')
const refPedida = args.find((a) => !a.startsWith('--'))

/* Aviso temprano si alguien agregó una ruta a App.tsx y no la sumó acá. No falla a
   propósito: que la hoja salga incompleta es mejor que que no salga. */
const appTsx = fs.readFileSync(path.join(RAIZ, 'src', 'App.tsx'), 'utf8')
const declaradas = [...appTsx.matchAll(/<Route\s+path="([^"*]+)"/g)]
  .map((m) => m[1])
  .filter((r) => !r.startsWith('/admin'))
const faltan = declaradas.filter((r) => !RUTAS.includes(r))
if (faltan.length) {
  log('[capturas] AVISO: App.tsx declara rutas que este script no captura: ' + faltan.join(', '))
  log('           Sumalas a RUTAS en scripts/capturas.mjs.')
}

let sucio = false
let base = 'HEAD'
let baseSha = ''

const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'lqc-capturas-'))
const nmEnlace = path.join(wt, 'node_modules')
let servidores = []
let navegador = null
let limpiado = false

/* Una única rutina de limpieza, idempotente, que corre tanto por el `finally` como por
   Ctrl+C. Antes no había nada para Ctrl+C, y como la corrida dura minutos, cortarla dejaba
   el `.env` del repo —con la clave anon— tirado en %TEMP% junto a una junction viva. */
async function limpiar() {
  if (limpiado) return
  limpiado = true
  try {
    await navegador?.close()
  } catch {
    /* ya estaba cerrado */
  }
  await Promise.all(servidores.map((s) => s.cerrar().catch(() => {})))

  /* EL ORDEN DE ACÁ ABAJO ES LA PARTE PELIGROSA DEL SCRIPT. `git worktree remove --force`
     SÍ borra a través de una junction de Windows (verificado en un repo de juguete: vació el
     directorio destino). O sea que soltar la junction no es higiene, es lo único que separa
     una limpieza normal de vaciar el `node_modules` del repo. Por eso, si no se puede
     soltar —EBUSY es realista en Windows: basta un editor o un tsc con handles abiertos—,
     NO se toca el worktree y se avisa para que lo borre una persona. */
  try {
    fs.rmSync(nmEnlace, { recursive: true, force: true })
  } catch (e) {
    console.error('\n[capturas] No pude soltar la junction ' + nmEnlace + ' (' + e.code + ').')
    console.error('           NO toco el worktree: hacerlo con la junction puesta vaciaría el')
    console.error('           node_modules del repo. Borralo a mano cuando se libere:')
    console.error('           rmdir "' + nmEnlace + '" && git worktree remove --force "' + wt + '"\n')
    return
  }
  if (fs.existsSync(nmEnlace)) {
    console.error('\n[capturas] La junction sigue en ' + nmEnlace + '. No corro `worktree remove` con ella puesta.\n')
    return
  }
  spawnSync('git', ['worktree', 'remove', '--force', wt], { cwd: RAIZ })
  spawnSync('git', ['worktree', 'prune'], { cwd: RAIZ })
  fs.rmSync(wt, { recursive: true, force: true })
  /* La guardia va DESPUÉS del borrado, que es la única línea capaz de hacer el daño.
     Ponerla antes —como estaba— no podía detectar nada. */
  if (!fs.existsSync(path.join(RAIZ, 'node_modules', 'vite'))) {
    console.error('\n[capturas] ABORTÁ: el node_modules del repo quedó vacío al limpiar. Corré `npm install` antes de seguir.\n')
  }
}

for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => {
    log('\n[capturas] Cortado; limpiando el worktree y la copia del .env...')
    limpiar().finally(() => process.exit(130))
  })
}

try {
  sucio = git(['status', '--porcelain']).length > 0
  base = refPedida || (sucio ? 'HEAD' : 'HEAD~1')
  if (!refPedida && !sucio) {
    log('[capturas] El árbol está limpio, así que no hay «después» sin commitear: comparo HEAD contra HEAD~1.')
  }
  baseSha = git(['rev-parse', '--short', base])

  fs.rmSync(SALIDA, { recursive: true, force: true })
  fs.mkdirSync(SALIDA, { recursive: true })

  /* REGLA 1: los dos lados se construyen ahora, en esta corrida. Nada de reutilizar. */
  construir(RAIZ, 'DESPUÉS (' + (sucio ? 'árbol de trabajo' : 'HEAD') + ')')

  git(['worktree', 'add', '--detach', wt, base])
  /* Junction en vez de `npm ci`: copiar node_modules son 185 MB y medio minuto; la junction
     es instantánea y no necesita permisos de administrador. Se borra explícitamente más
     abajo, ANTES de soltar el worktree, para que ningún borrado recursivo la atraviese. */
  fs.symlinkSync(path.join(RAIZ, 'node_modules'), nmEnlace, 'junction')
  const entorno = copiarEntorno(wt)
  log('[capturas] entorno copiado al worktree: ' + (entorno.join(', ') || 'ninguno (no hay .env local)'))
  construir(wt, 'ANTES (' + base + ' = ' + baseSha + ')')

  servidores = await Promise.all([
    servirEstatico(path.join(wt, 'dist'), PUERTOS.antes),
    servirEstatico(path.join(RAIZ, 'dist'), PUERTOS.despues),
    servirEstatico(SALIDA, PUERTOS.hoja),
  ])
  const [srvAntes, srvDespues, srvHoja] = servidores

  navegador = await chromium.launch({ channel: 'chrome' }).catch(() => {
    fallar('no encontré el Chrome del sistema. Esta herramienta lo usa tal cual y no descarga navegadores; instalá Google Chrome y volvé a correrla.')
  })
  const versionChrome = navegador.version()
  const celdas = []
  let ruidoGlobalPix = 0
  let ruidoGlobalDelta = 0

  /* Si dos rutas futuras colapsaran al mismo nombre de archivo, una pisaría a la otra y la
     hoja mostraría el par equivocado sin decir nada. Barato de detectar, caro de descubrir. */
  const slugsVistos = new Set()

  for (const vp of ANCHOS) {
    const ctx = await navegador.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      /* Sin esto la hoja miente en casi todas las rutas. La copa de fondo corre dos
         animaciones infinitas (`lqc-copa-deriva` 97s y `lqc-copa-balanceo` 61s, en
         index.css) con un `animation-delay` NEGATIVO que se calcula en JS desde el reloj
         real, a propósito, para que la trayectoria sobreviva a los cambios de página. O
         sea: la posición de la copa es función de la hora. Entre la captura del «antes» y
         la del «después» pasan segundos, así que la copa se movió de verdad, y la primera
         corrida reportó 14 de 16 rutas «con cambios» cuando el cambio era solo tooling.
         Fijar `currentTime` a mano no alcanza: cada carga arranca con un delay distinto.
         `prefers-reduced-motion` sí, y no es un truco: el sitio lo implementa aposta
         —index.css la deja QUIETA y centrada— así que es un estado real y determinista.
         A cambio, la hoja no sirve para revisar la animación en movimiento; para eso, a
         mano en el navegador. */
      reducedMotion: 'reduce',
    })
    /* El encabezado lleva una tira con la hora local de Querétaro (`TiraHud` +
       `useHoraLocal`) que, como dice su propio comentario, «cambia sola cada minuto». Está
       en TODAS las páginas: si el minuto avanza entre la captura del «antes» y la del
       «después» —y entre las dos pasan segundos—, las ocho rutas acusan un cambio que no
       existe. Se fija el reloj en un único instante, calculado una sola vez al arrancar, de
       modo que los dos lados vean exactamente el mismo «ahora». Se usa la hora real de la
       corrida y no una inventada para que la hoja siga siendo creíble de leer. */
    await ctx.addInitScript((fijo) => {
      const Real = Date
      const Falso = function (...args) {
        return args.length === 0 ? new Real(fijo) : new Real(...args)
      }
      Falso.prototype = Real.prototype
      Falso.now = () => fijo
      Falso.parse = Real.parse
      Falso.UTC = Real.UTC
      window.Date = Falso
    }, AHORA)
    /* El revelado por scroll deja de esperar al scroll mientras fotografiamos. `fullPage`
       captura más allá del viewport sin disparar el IntersectionObserver, así que lo que se
       revela al entrar en pantalla (`Reveal.tsx`) salía en su estado previo a la animación.
       Se reemplaza el observador por uno que declara TODO visible apenas lo observan, que es
       exactamente lo que quiere una captura estática: es agnóstico de la librería y da el
       mismo resultado en los dos lados.
       Esto NO alcanza al `loading="lazy"` nativo del <img>, que Chrome resuelve por dentro
       sin pasar por esta clase: eso lo cubre `__imagenesEnCaptura`, acá abajo. Una versión
       anterior de este comentario decía que el observador arreglaba las fotos de /galeria;
       no era cierto, la galería nunca usó uno. */
    await ctx.addInitScript(() => {
      window.IntersectionObserver = class {
        constructor(cb) {
          this._cb = cb
        }
        observe(el) {
          this._cb(
            [{ isIntersecting: true, intersectionRatio: 1, target: el, boundingClientRect: el.getBoundingClientRect(), intersectionRect: el.getBoundingClientRect(), rootBounds: null, time: 0 }],
            this,
          )
        }
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return []
        }
        get root() {
          return null
        }
        get rootMargin() {
          return '0px'
        }
        get thresholds() {
          return [0]
        }
      }
    })
    /* Las imágenes que salen en la foto, y solo esas. Dos casos que se descubrieron MIRANDO
       la hoja, con el recuento diciendo otra cosa:
       - /galeria usa `loading="lazy"` NATIVO (y también el pie, Home y /carta), que no pasa
         por el IntersectionObserver reemplazado arriba. En teléfono, más de la mitad de las
         fotos salían como rectángulos vacíos EN LOS DOS LADOS. La celda sí salía marcada
         como no confiable, pero se le echó la culpa a la red; mirando la captura se vio que
         esas fotos nunca se habían pedido. Por eso `asentarImagenes` las pasa a `eager`.
       - /carta monta el catálogo de campeones entero en una lista con scroll propio de 288px
         (`max-h-72 overflow-y-auto`). Los que quedan fuera de esa caja no salen en la
         captura, y como son lazy y nadie scrollea la caja, nunca se piden. Se contaban igual
         como «sin terminar de cargar» (146 por carga; el «438» de la hoja era la suma de las
         tres), la celda salía marcada como no confiable y cada carga esperaba dos vueltas de
         33s algo que no podía pasar. Se atribuyó al CDN de Riot y no era eso.
       Recortada = fuera de la caja de un ancestro que recorta en ese eje. `html` y `body` no
       cuentan: `fullPage` captura el documento entero. Una imagen `absolute` o `fixed` puede
       escapar del recorte de sus ancestros, así que ante la duda cuenta: esperar de más
       cuesta segundos, y contar de menos da un «todo cargado» falso. */
    await ctx.addInitScript(() => {
      window.__imagenesEnCaptura = () =>
        Array.from(document.images).filter((img) => {
          if (img.getClientRects().length === 0) return false
          const r = img.getBoundingClientRect()
          const raiz = (el) => el === document.body || el === document.documentElement
          for (let el = img; el.parentElement && !raiz(el.parentElement); ) {
            const pos = getComputedStyle(el).position
            if (pos === 'absolute' || pos === 'fixed') return true
            el = el.parentElement
            const cs = getComputedStyle(el)
            const c = el.getBoundingClientRect()
            if (cs.overflowY !== 'visible' && (r.bottom <= c.top || r.top >= c.bottom)) return false
            if (cs.overflowX !== 'visible' && (r.right <= c.left || r.left >= c.right)) return false
          }
          return true
        })
    })
    /* La temperatura de la tira (`TiraHud`, en todas las páginas) viene de Open-Meteo: un
       dato ajeno que cambia solo y que a veces no llega. Pasó en la corrida que validaba
       esta herramienta: /galeria en teléfono acusó «10 filas cambian» porque el «antes»
       mostraba «22°C» y en el «después» la consulta falló y el segmento desapareció. Mismo
       remedio que el reloj: se pide UNA vez por corrida y se sirve esa misma respuesta
       —o el mismo fallo— a los dos lados. El corte de 7s queda por debajo de los 8s con que
       el sitio aborta, para que una respuesta lenta cuente como fallo desde la primera
       carga y no aparezca recién en la segunda.
       Efecto colateral: interceptar cualquier cosa apaga la caché HTTP del contexto, así que
       Supabase y Data Dragon se vuelven a bajar en cada carga. Los tiempos medidos de
       AGENTS.md ya lo incluyen. */
    await ctx.route('https://api.open-meteo.com/**', async (route) => {
      const url = route.request().url()
      /* `.catch` y no el segundo argumento de `.then`, que no atrapa un fallo de `r.body()`.
         Un rechazo dentro de este handler no lo agarra nadie: el proceso muere sin pasar por
         el `finally` y deja tirados el worktree, la junction y la copia del .env. */
      if (!climaPorUrl.has(url)) {
        climaPorUrl.set(
          url,
          route
            .fetch({ timeout: 7000 })
            .then(async (r) => ({ status: r.status(), body: await r.body() }))
            .catch(() => null),
        )
      }
      const clima = await climaPorUrl.get(url)
      if (!clima) return route.abort()
      return route.fulfill({
        status: clima.status,
        body: clima.body,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
      })
    })
    ctx.setDefaultTimeout(30000)
    ctx.setDefaultNavigationTimeout(45000)
    let page = await ctx.newPage()
    /* Una sola pestaña para todas las mediciones del ancho, en vez de abrir y cerrar una
       por comparación: son 32 navegaciones menos por corrida. */
    const analizador = await ctx.newPage()
    await analizador.goto(srvHoja.url + '/_analizador')
    const medir = (a, b) =>
      conLimite(
        analizador.evaluate(DIFF_EN_PAGINA, [srvHoja.url + '/' + a, srvHoja.url + '/' + b]),
        90000,
        'la comparación de ' + a,
      )

    for (const ruta of RUTAS) {
      const slug = (vp.nombre + (ruta === '/' ? '-inicio' : ruta.replace(/\//g, '-'))).replace(/[^a-z0-9-]/gi, '')
      if (slugsVistos.has(slug)) fallar('dos rutas producen el mismo nombre de archivo («' + slug + '»). Cambiá una en RUTAS.')
      slugsVistos.add(slug)
      const fAntes = slug + '-antes.png'
      const fDespues = slug + '-despues.png'
      const fRuido = slug + '-ruido.png'
      log('[capturas] ' + vp.nombre + ' ' + ruta)
      try {
        /* REGLA 3: dos fotos del «antes» seguidas. La segunda no se muestra; sirve para
           medir cuánto difieren dos capturas que por definición deberían ser idénticas. */
        const pendientes = await conLimite(
          (async () => {
            const a = await prepararYCapturar(page, srvAntes.url + ruta, path.join(SALIDA, fAntes))
            /* La foto de control es una CARGA NUEVA del mismo lado, no un segundo disparo
               sobre la página ya congelada. Al principio era lo segundo, y así medía la
               repetibilidad del screenshot —que da cero— en vez de la varianza de carga a
               carga, que es justamente la que contamina la comparación real. Medía algo
               cierto pero inútil, y el umbral terminaba siendo la constante de siempre. */
            const r = await prepararYCapturar(page, srvAntes.url + ruta, path.join(SALIDA, fRuido))
            const d = await prepararYCapturar(page, srvDespues.url + ruta, path.join(SALIDA, fDespues))
            return a.pendientes + r.pendientes + d.pendientes
          })(),
          /* Seis minutos por celda, holgado a propósito: son TRES cargas completas, y cada
             una puede gastar hasta 55s por vuelta —son dos vueltas— esperando imágenes
             (`asentarImagenes`). Con el tope en 180s una celda así moría por timeout —o
             sea, se perdía la captura entera— en vez de salir con su aviso de imágenes
             pendientes. Vale más una celda lenta y marcada que una celda ausente. */
          360000,
          'la captura de ' + ruta,
        )

        const ruido = await medir(fAntes, fRuido)
        const senal = await medir(fAntes, fDespues)

        const umbralPix = Math.max(UMBRAL_PIXELES, ruido.maxPix + 1)
        const umbralDelta = Math.max(UMBRAL_DELTA, ruido.maxDelta + 1)
        ruidoGlobalPix = Math.max(ruidoGlobalPix, ruido.maxPix)
        ruidoGlobalDelta = Math.max(ruidoGlobalDelta, ruido.maxDelta)

        const reales = senal.filas.filter((f) => f.n >= umbralPix && f.mx >= umbralDelta)
        const difAlto = senal.altoB - senal.altoA
        const difAncho = senal.anchoB - senal.anchoA
        const partes = []
        if (reales.length) {
          partes.push(reales.length + ' filas cambian (y ' + reales[0].y + '–' + reales[reales.length - 1].y + ')')
        } else if (senal.totalPix > 0) {
          /* Hay señal, pero por debajo del umbral. Decirlo es importante: «sin cambios
             visibles» es una afirmación, y un ícono de 12px, un borde de 1px o una palabra
             en una columna angosta no llegan a 20 píxeles por fila. Mejor mandar a mirar
             que afirmar de más. */
          partes.push('cambios muy chicos (' + senal.totalPix + ' px en ' + senal.filas.length + ' filas) — miralo igual')
        }
        if (difAlto) partes.push('la página ' + (difAlto > 0 ? 'crece' : 'encoge') + ' ' + Math.abs(difAlto) + 'px')
        if (difAncho) {
          partes.push('la página se ' + (difAncho > 0 ? 'ensancha' : 'angosta') + ' ' + Math.abs(difAncho) + 'px (¿desborde horizontal?)')
        }
        if (senal.truncado) partes.push('comparación recortada a 16384px')
        /* Que se vea en la hoja, no solo en la consola: una captura con imágenes a medias no
           es comparable, y el veredicto de esta celda —diga lo que diga— no vale. */
        if (pendientes > 0) partes.push('OJO: ' + pendientes + ' imágenes sin terminar de cargar, esta celda no es confiable')

        celdas.push({
          vp: vp.nombre,
          ruta,
          archivoAntes: fAntes,
          archivoDespues: fDespues,
          veredicto: partes.length ? 'cambia' : 'igual',
          resumen: partes.length ? partes.join(' · ') : 'sin cambios visibles',
        })
      } catch (e) {
        celdas.push({
          vp: vp.nombre,
          ruta,
          archivoAntes: fAntes,
          archivoDespues: fDespues,
          veredicto: 'error',
          resumen: 'falló: ' + String(e.message).split('\n')[0],
        })
        /* Si se venció el plazo, la pestaña puede haber quedado colgada en un evaluate que
           nunca vuelve. Se descarta y se abre otra, para que una ruta mala no arrastre a las
           que siguen. */
        try {
          await page.close()
        } catch {
          /* ya estaba cerrada */
        }
        page = await ctx.newPage()
      }
      fs.rmSync(path.join(SALIDA, fRuido), { force: true })
    }
    await ctx.close()
  }
  await navegador.close()

  escribirHoja(celdas, {
    base: base + ' (' + baseSha + ')',
    despues: sucio ? 'árbol de trabajo' : 'HEAD',
    fecha: new Date().toLocaleString('es-MX'),
    chrome: versionChrome,
    ruido: ruidoGlobalPix + ' px en la fila más ruidosa, delta máximo ' + ruidoGlobalDelta,
  })

  const cambian = celdas.filter((c) => c.veredicto === 'cambia')
  const fallan = celdas.filter((c) => c.veredicto === 'error')
  log('\n[capturas] ' + celdas.length + ' pares · ' + cambian.length + ' con cambios · ' + fallan.length + ' con error')
  for (const c of cambian) log('           ' + c.vp + ' ' + c.ruta + ' — ' + c.resumen)
  for (const c of fallan) log('           ' + c.vp + ' ' + c.ruta + ' — ' + c.resumen)
  log('\n[capturas] Hoja: ' + path.join(SALIDA, 'index.html'))
  log('[capturas] MIRALA. Un cambio de UI se aprueba viéndolo, no leyendo estos números.')
} catch (e) {
  /* `process.exitCode` y no `process.exit()`: el segundo se saltaría el `finally` y con él
     toda la limpieza, que es el bug que este archivo ya pagó una vez. */
  console.error('\n[capturas] ' + (e instanceof ErrorCapturas ? e.message : 'falló inesperadamente:\n' + (e?.stack || e)) + '\n')
  process.exitCode = 1
} finally {
  await limpiar()
}

if (abrir && process.exitCode !== 1) {
  spawnSync(process.platform === 'win32' ? 'explorer' : 'open', [path.join(SALIDA, 'index.html')], {
    shell: process.platform === 'win32',
  })
}
