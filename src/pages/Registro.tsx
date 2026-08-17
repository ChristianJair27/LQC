import { useEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Users, Gamepad2, User, Calendar, Phone, GraduationCap,
  MapPin, Mail, UserCircle, ShieldCheck, CreditCard, Crown,
  Send, CheckCircle, AlertCircle, Check, Facebook, MessageSquare,
  Loader2, FileText, ExternalLink, Download
} from 'lucide-react'
import { obtenerSupabase } from '../lib/supabase'
import { RUTA_REGLAMENTO, NOMBRE_DESCARGA, PESO_REGLAMENTO } from '../lib/reglamento'
import { validarRiotId } from '../lib/atak'
import type { ResultadoRiotId } from '../lib/atak'

/* ------------------------------------------------------------------ */
/*  Modelo del formulario                                              */
/* ------------------------------------------------------------------ */

/* MODELO ACTUAL: cada jugador se registra SOLO, sobre el esquema relacional.
   Es la tercera forma que tiene esta página y conviene tener claras las tres,
   porque la de en medio dejó rastros por todo el repo:

     1. Una fila de `inscripciones` = un jugador, con el nombre del equipo como
        string repetido en cada fila. Un typo partía el equipo en dos.
     2. El capitán registraba al equipo ENTERO en un envío (`registrar_equipo`),
        con un roster de 5 a 7 tarjetas en la misma pantalla. Arregló el typo
        —el equipo se escribía una sola vez— pero puso a una persona a cargar los
        datos personales de otras seis desde un teléfono.
     3. Ésta: vuelve el registro individual, pero el equipo ya no es un string
        suelto. Quien se registra ELIGE su equipo de una lista de sugerencias que
        sale de la base (`buscar_equipos`), y solo si no está lo crea escribiendo
        el nombre. El typo se evita por reconocimiento, no por disciplina.

   Consecuencia directa para el código de acá abajo: todo lo que el modelo 2
   había tenido que indexar por jugador —claves de error compuestas, ids del DOM
   con uid delante, N validaciones de Riot ID en vuelo, alta y baja de tarjetas—
   vuelve a ser un solo juego de campos planos. Si algo de eso reaparece en un
   diff, es que alguien está resucitando el modelo 2 sin querer.

   Lo que NO cambió: las dos tablas (`equipos` y `jugadores`) y el panel de
   `/admin`, que las lee igual. Esta reescritura es de la superficie pública. */

/* Campos del formulario. `escolaridad_otro` y `genero_otro` viven en el estado
   pero NO viajan: se resuelven antes de armar el payload. `equipo` tampoco viaja
   tal cual — ver `PayloadRegistro`. */
type CampoForm =
  | 'equipo'
  | 'gamertag'
  | 'nombre'
  | 'fecha_nacimiento'
  | 'celular'
  | 'correo'
  | 'municipio'
  | 'escolaridad'
  | 'escolaridad_otro'
  | 'genero'
  | 'genero_otro'

type FormState = Record<CampoForm, string>

const FORM_VACIO: FormState = {
  equipo: '',
  gamertag: '',
  nombre: '',
  fecha_nacimiento: '',
  celular: '',
  correo: '',
  municipio: '',
  escolaridad: '',
  escolaridad_otro: '',
  genero: '',
  genero_otro: ''
}

/* Los dos números del roster. Ya no los aplica esta página —nadie arma un roster
   acá—, pero los sigue necesitando para dos cosas distintas: MAX para saber qué
   equipo sugerido está lleno y no dejar elegirlo, y MIN como referencia en la
   pantalla de éxito ("tu equipo tiene 3 de 5 jugadores mínimos"), que es lo único
   que le dice a alguien que todavía faltan compañeros por registrarse.
   TITULARES parte el equipo en dos: la RPC asigna titular a los 5 primeros por el
   `orden` que ella misma calcula, así que acá solo se refleja esa regla. */
const MIN_JUGADORES = 5
const MAX_JUGADORES = 7
const TITULARES = 5

/* Tope de equipos de toda la liga, no de este formulario. Sale del reglamento
   oficial —«Esta liga estará limitada a un máximo de 32 equipos»— y quien lo hace
   cumplir es la RPC, que rechaza con 'torneo_lleno'. Acá el número existe solo para
   poder decirlo en el mensaje: esta página no lo comprueba ni podría (no lee las
   tablas). Si cambia en el reglamento, cambia en la base; esto es una copia y hay
   que actualizarla a mano. */
const MAX_EQUIPOS = 32

/* Orden VISUAL de las claves de error, para llevar el foco al primer campo con
   problema. Vuelve a ser una constante y no una función: sin roster de tamaño
   variable, la lista de campos no depende del estado. */
const ORDEN_CLAVES: string[] = [
  'equipo',
  'gamertag',
  'nombre',
  'fecha_nacimiento',
  'celular',
  'correo',
  'municipio',
  'escolaridad',
  'escolaridad_otro',
  'genero',
  'genero_otro',
  'privacidad'
]

/* ------------------------------------------------------------------ */
/*  Errores                                                            */
/* ------------------------------------------------------------------ */

/* Claves planas, y ahora la clave de error y el `id` del control son LA MISMA
   cadena. En el modelo del roster no podían serlo (las claves llevaban un punto,
   que no es válido en un selector sin escapar) y había una función `idDeClave`
   traduciendo entre las dos. Ya no hace falta, pero la regla que la justificaba
   sigue en pie y es la que hace funcionar a `enfocarClave`: si un control no tiene
   por id su clave de error, el foco al primer campo inválido lo salta EN SILENCIO.
   La regla es sobre el `id` y nada más. El `name` coincide en los inputs por
   comodidad, pero no siempre existe: en el campo de equipo con un equipo ya elegido,
   el control con `id="equipo"` es un <button>, que no lleva `name`. */
type Errores = Record<string, string>

/* ------------------------------------------------------------------ */
/*  Contrato con las RPC                                               */
/* ------------------------------------------------------------------ */

/* El cliente anónimo NO lee las tablas: su única superficie son estas dos
   funciones, que corren con permisos propios. No intentar un `.select()` sobre
   `equipos` ni `jugadores` — no va a devolver nada y no es un bug de RLS. */

/* --- buscar_equipos(termino) → hasta 5 filas, ordenadas por similitud --- */

/* Lo que la RPC devuelve por equipo. Es información PÚBLICA a propósito: el
   nombre y cuántos jugadores tiene, nada personal. `jugadores` no es decorativo
   —es lo que permite reconocer al equipo correcto entre dos nombres parecidos y
   lo que decide si está lleno—, así que una fila sin ese dato no sirve. */
type EquipoSugerido = { id: string; nombre: string; jugadores: number }

/* Tope de sugerencias que se pintan. La RPC ya devuelve como mucho 5; esto es un
   segundo techo del lado del cliente para que un cambio del lado de la base no
   se traduzca en una lista de 40 elementos tapando el formulario. */
const MAX_SUGERENCIAS = 5

/* Lectura defensiva, con el mismo criterio que `leerVeredicto` en src/lib/atak.ts:
   llega como `unknown` y cada fila se acepta solo si tiene la forma exacta. Una
   fila rota se descarta en vez de contaminar la lista con `undefined`.
   `jugadores` se acepta como número o como cadena numérica: PostgREST serializa
   los `bigint` (lo que devuelve un count) como número, pero si algún día llegara
   como texto, aceptarlo cuesta dos líneas y evita que la lista quede vacía sin
   que nadie entienda por qué. */
function leerSugerencias(cuerpo: unknown): EquipoSugerido[] {
  if (!Array.isArray(cuerpo)) return []

  const lista: EquipoSugerido[] = []
  for (const fila of cuerpo) {
    if (typeof fila !== 'object' || fila === null) continue

    const { id, nombre, jugadores } = fila as {
      id?: unknown
      nombre?: unknown
      jugadores?: unknown
    }
    if (typeof id !== 'string' || !id) continue
    if (typeof nombre !== 'string' || !nombre) continue

    const cantidad =
      typeof jugadores === 'number'
        ? jugadores
        : typeof jugadores === 'string' && /^\d+$/.test(jugadores)
          ? Number(jugadores)
          : null
    if (cantidad === null || !Number.isFinite(cantidad)) continue

    lista.push({ id, nombre, jugadores: cantidad })
    if (lista.length >= MAX_SUGERENCIAS) break
  }
  return lista
}

/* --- registrar_jugador(datos) --- */

/* Forma EXACTA que espera la RPC. El tipo es una UNIÓN y eso es el contrato, no
   un adorno: el objeto lleva `equipo_id` (eligió un equipo existente) o `equipo`
   (escribió un nombre nuevo y la función lo crea), NUNCA los dos. Los dos errores
   quedan atrapados en compilación y no en runtime con el banner genérico, pero por
   mecanismos distintos que conviene no confundir: mandar las DOS claves a la vez falla
   por los `?: never` de abajo (ninguna rama de la unión lo acepta), mientras que mandar
   una clave DESCONOCIDA —`rol`, por ejemplo— falla por el chequeo de propiedades en
   exceso que activa anotar el objeto literal. Sin los `?: never`, las dos claves juntas
   pasarían sin queja.

   `rol` y `orden` NO van: los asigna la función. El rol sale del orden —titular
   los 5 primeros, suplente del 6º— y el orden lo calcula ella contando lo que ya
   hay en el equipo.

   DEUDA (heredada, sigue vigente): lo correcto a futuro es generar los tipos del
   esquema con `supabase gen types typescript` y pasarlos como
   `SupabaseClient<Database>`. Hoy el cliente está tipado como `SupabaseClient`
   pelado, así que `.rpc()` acepta literalmente cualquier cosa y esta unión es la
   única red que hay. */
type PayloadBase = {
  gamertag: string
  nombre: string
  fecha_nacimiento: string
  celular: string
  correo: string
  municipio: string
  escolaridad: string
  genero: string
  es_capitan: boolean
}

type PayloadRegistro =
  | (PayloadBase & { equipo_id: string; equipo?: never })
  | (PayloadBase & { equipo: string; equipo_id?: never })

/* Códigos de rechazo de la RPC. Son rechazos de NEGOCIO, no fallos técnicos: la
   llamada salió bien y la función dijo que no. Por eso viajan por un estado
   propio y no por el banner de error de red. */
type CodigoRechazo =
  | 'falta_gamertag'
  | 'falta_equipo'
  | 'equipo_lleno'
  | 'gamertag_duplicado'
  | 'torneo_lleno'

/* Mensajes accionables: cada uno dice QUÉ pasó y QUÉ hacer.
   Los tres que más contexto necesitan son los que la persona no puede anticipar:
   `equipo_lleno` describe una carrera (el equipo se llenó entre que salió en las
   sugerencias y que se pulsó enviar), `gamertag_duplicado` suele significar que
   ya se registró antes —no que haya hecho algo mal— y `torneo_lleno` es el único
   que NO es un problema del formulario sino un límite de la liga.

   `torneo_lleno` es además el que más fácil se malinterpreta, y por eso su mensaje
   es el más largo: el tope de MAX_EQUIPOS bloquea CREAR equipos nuevos, pero
   unirse a uno ya inscrito sigue permitido. Sin decirlo, quien lo lea va a
   entender «el torneo está cerrado, no puedo participar» y se va — cuando en
   realidad si sus compañeros ya registraron el equipo, le basta con elegirlo de las
   sugerencias. Es la diferencia entre perder a una persona y perder nada. */
const MENSAJE_RECHAZO: Record<CodigoRechazo, string> = {
  falta_gamertag: 'Falta tu Riot ID. Escríbelo arriba y vuelve a enviar.',
  falta_equipo: 'Falta el equipo. Elígelo de las sugerencias o escribe un nombre nuevo.',
  equipo_lleno: `Ese equipo ya llegó a ${MAX_JUGADORES} jugadores y no admite más. Si acaba de llenarse mientras llenabas el formulario, habla con tu capitán: puede que te toque otro equipo.`,
  gamertag_duplicado:
    'Ese Riot ID ya está registrado en ese equipo. Si fuiste tú, ya estás dentro y no hace falta registrarte de nuevo.',
  /* Las instrucciones son las del combobox REAL, no las que uno supondría. «Borra el
     nombre y vuelve a escribirlo» era lo primero que se me ocurrió y es justo lo
     contrario de lo que hay que hacer: por debajo de MIN_TERMINO_BUSQUEDA el combobox
     vacía las sugerencias y cierra la lista, o sea que borrar el nombre destruye
     exactamente lo que se quiere ver. Un carácter menos relanza la búsqueda. */
  torneo_lleno: `El torneo ya llegó a su máximo de ${MAX_EQUIPOS} equipos, así que no se pueden crear equipos nuevos. Pero todavía puedes unirte a un equipo ya inscrito: borra la última letra del nombre para que vuelvan a aparecer las sugerencias y elige tu equipo ahí. Si tus compañeros ya lo registraron, va a estar en la lista.`
}

/* Los códigos que `leerRespuesta` sabe reconocer, DERIVADOS del mapa de mensajes en vez
   de escritos a mano. La lista a mano fue exactamente el bug que trajo hasta acá:
   'torneo_lleno' se sumó al backend, no se agregó a este arreglo, y como un
   `CodigoRechazo[]` incompleto compila sin una queja, el rechazo caía en 'desconocido'
   y salía el banner de fallo técnico. Los tres `Record<CodigoRechazo, …>` sí obligan a
   cubrirlos todos; colgando el arreglo de uno de ellos, un código nuevo ya no puede
   quedar reconocido a medias. */
const CODIGOS_RECHAZO = Object.keys(MENSAJE_RECHAZO) as CodigoRechazo[]

/* Versión corta para el error del CAMPO. Los rechazos se pintan en dos lugares
   —el banner y el propio control, que además recibe el foco—, así que con un solo
   texto largo un lector de pantalla lo lee entero dos veces: una por el
   `role="alert"` y otra por el `aria-describedby` del control enfocado. La
   explicación completa vive solo en el banner. */
const MENSAJE_RECHAZO_CAMPO: Record<CodigoRechazo, string> = {
  falta_gamertag: 'Escribe tu Riot ID.',
  falta_equipo: 'Elige o escribe tu equipo.',
  equipo_lleno: 'Ese equipo está lleno. Lee el detalle en el aviso de abajo.',
  gamertag_duplicado: 'Ese Riot ID ya está en ese equipo. Lee el detalle abajo.',
  /* Dice el camino que SIGUE abierto y no el que se cerró, porque es lo accionable. Y
     cierra apuntando al banner, como los otros dos: el detalle largo —incluido el
     correo de contacto para quien no encuentre a su equipo— vive solo ahí.
     Lo que se lee al recibir el foco no es solo esto: el input tiene en su
     `aria-describedby` la ayuda ANTES que el error, y esa ayuda también cambia con la
     creación bloqueada. Las dos cosas tienen que decir lo mismo. */
  torneo_lleno:
    'No se pueden crear equipos nuevos. Elige tu equipo de la lista o lee el detalle en el aviso de abajo.'
}

/* A qué control lleva el foco cada rechazo. Es el mapa que hace que un rechazo
   del servidor termine en el campo que hay que corregir y no en el tope de la
   página. */
const CAMPO_DE_RECHAZO: Record<CodigoRechazo, 'equipo' | 'gamertag'> = {
  falta_gamertag: 'gamertag',
  gamertag_duplicado: 'gamertag',
  falta_equipo: 'equipo',
  equipo_lleno: 'equipo',
  /* Al campo de equipo, que es donde está la salida: el tope solo bloquea crear, y
     elegir uno existente se hace ahí mismo. */
  torneo_lleno: 'equipo'
}

/* Lo que devuelve un registro exitoso, ya leído. `equipo_id` no se usa en la
   pantalla —no hay nada que mostrarle a la persona con un uuid— así que no se
   guarda; `orden` sí, y es el dato que sostiene toda la pantalla de éxito. */
type RegistroOk = { orden: number }

/* Lectura defensiva de la respuesta. Cualquier forma que no reconozcamos cae en
   'desconocido' y se trata como fallo genérico, que es lo único honesto que se
   puede decir de una respuesta que no se entiende.

   `orden` se lee como el número de jugadores que el equipo tiene AHORA. Eso exige que
   sea 1-based, y lo es: verificado el 2026-07-30, la función hace
   `v_orden := v_total + 1` (por eso el suplente empieza «del 6º»). Estuvo un día
   documentado acá como suposición del cliente; ya no lo es.
   El guard de abajo se queda igual de estricto de todos modos, porque protege contra
   otra cosa: una respuesta con `orden` ausente o con basura. Y si alguna vez la función
   cambiara a 0-based, el primer jugador de cada equipo recibiría `orden:0` y caería en
   'desconocido' —banner de fallo sobre un registro que sí entró—, que es ruidoso y
   por lo tanto preferible a pintar un jugador de menos en silencio. */
function leerRespuesta(
  cuerpo: unknown
): { tipo: 'ok'; datos: RegistroOk } | { tipo: CodigoRechazo | 'desconocido' } {
  if (typeof cuerpo !== 'object' || cuerpo === null) return { tipo: 'desconocido' }

  const { ok, error, orden } = cuerpo as {
    ok?: unknown
    error?: unknown
    orden?: unknown
  }

  if (ok === true) {
    /* Se acepta número o cadena numérica, por la misma razón que en
       `leerSugerencias`: los dos valores son conteos que salen del mismo backend y no
       hay motivo para ser estricto acá y flexible allá. La asimetría además costaba
       caro: un `orden:"3"` caía en 'desconocido' y la persona veía «No pudimos enviar
       tu registro» sobre una fila que YA se había insertado — y al reintentar, un
       `gamertag_duplicado` diciéndole que ya estaba registrada. Tres mensajes
       contradictorios seguidos, todos sobre un registro exitoso. */
    const cantidad =
      typeof orden === 'number'
        ? orden
        : typeof orden === 'string' && /^\d+$/.test(orden)
          ? Number(orden)
          : NaN
    /* Un `ok:true` sin un `orden` utilizable sigue siendo 'desconocido': la pantalla
       de éxito entera se apoya en ese número, e inventar un 1 le diría a la persona
       algo falso sobre su equipo. */
    if (!Number.isFinite(cantidad) || cantidad < 1) return { tipo: 'desconocido' }
    return { tipo: 'ok', datos: { orden: cantidad } }
  }

  if (ok !== false) return { tipo: 'desconocido' }

  return { tipo: CODIGOS_RECHAZO.find((codigo) => codigo === error) ?? 'desconocido' }
}

/* ------------------------------------------------------------------ */
/*  Validación (helpers puros)                                         */
/* ------------------------------------------------------------------ */

const OPCIONES_ESCOLARIDAD = ['Secundaria', 'Prepa', 'Universidad', 'Otros']
const OPCIONES_GENERO = ['Masculino', 'Femenino', 'Otros']

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/* Riot ID completo: nombre (3–16 caracteres, cualquiera menos '#') + '#' + tag (2–5
   alfanuméricos). Se valida sobre el valor con trim(); las mayúsculas se conservan. */
const REGEX_RIOT_ID = /^[^#]{3,16}#[A-Za-z0-9]{2,5}$/

/* Estado de la comprobación del Riot ID contra ATAK.GG. 'inactivo' es también
   el estado al que vuelve cualquier fallo de la validación: si no se pudo
   comprobar, el campo no dice nada y el registro sigue su curso. */
type EstadoRiotId = 'inactivo' | 'validando' | 'valido' | 'no_encontrado'

/* El veredicto viaja atado al valor exacto sobre el que se pidió. Quien lo lee
   compara contra el Riot ID que hay ahora en el campo y descarta el que no
   corresponda, así un veredicto no puede quedar pegado a un valor que la persona
   ya cambió. */
type ValidacionRiotId = { valor: string; estado: EstadoRiotId }

const VALIDACION_INACTIVA: ValidacionRiotId = { valor: '', estado: 'inactivo' }

const MENSAJE_RIOT_ID_NO_EXISTE =
  'No encontramos ese Riot ID. Revisa las mayúsculas y el tag que va después del # (por ejemplo, Jugador#MX1).'

/* Solo dígitos y separadores de formato. Cualquier letra u otro símbolo se
   rechaza: sin esto, "abc0123456789" pasaría porque de la cadena igual se
   pueden pescar 10 dígitos. */
const REGEX_TELEFONO = /^[\d\s()+-]+$/

const TELEFONO_DIGITOS = 10

function validarTelefono(valor: string, faltante: string): string | undefined {
  const limpio = valor.trim()
  if (!limpio) return faltante
  if (!REGEX_TELEFONO.test(limpio)) {
    return 'Usa solo números. Se permiten espacios, guiones, paréntesis y +.'
  }
  if (soloDigitos(limpio).length !== TELEFONO_DIGITOS) {
    return `Deben ser exactamente ${TELEFONO_DIGITOS} dígitos, sin la lada del país (+52).`
  }
  return undefined
}

/* Lo que se guarda en la base: dígitos normalizados, sin separadores. */
function soloDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

/* Fecha local en formato YYYY-MM-DD ('sv-SE' da exactamente ese orden).
   No usar toISOString(): devuelve UTC y en Querétaro (UTC−6) a partir de las
   18:00 el "hoy" calculado ya sería el día siguiente. */
function fechaLocalISO(fecha: Date): string {
  return fecha.toLocaleDateString('sv-SE')
}

const EDAD_MINIMA = 16
const EDAD_MAXIMA = 80

/* Fecha de hoy corrida N años hacia atrás. Siempre relativa: un año literal
   (1946) envejece y en unos años deja de tener sentido. */
function fechaHaceAnios(anios: number): string {
  const hoy = new Date()
  return fechaLocalISO(new Date(hoy.getFullYear() - anios, hoy.getMonth(), hoy.getDate()))
}

/* Techo: última fecha que ya cumple EDAD_MINIMA años hoy (quien los cumple hoy entra). */
function fechaMaximaNacimiento(): string {
  return fechaHaceAnios(EDAD_MINIMA)
}

/* Piso: quien cumple EDAD_MAXIMA años hoy entra; un día antes ya no es plausible. */
function fechaMinimaNacimiento(): string {
  return fechaHaceAnios(EDAD_MAXIMA)
}

/* Se calculan al cargar el chunk de la página (no en el cuerpo del componente,
   que debe ser puro). `validar()` recalcula al vuelo, así que una pestaña
   abierta desde ayer como mucho tiene el calendario un día viejo. */
const MAX_FECHA_NACIMIENTO = fechaMaximaNacimiento()
const MIN_FECHA_NACIMIENTO = fechaMinimaNacimiento()

/* Techo del envío: pasado ese tiempo la llamada se aborta y se muestra el error
   genérico, en vez de dejar el botón en "Enviando…" hasta el timeout del
   navegador (que puede ser de minutos). */
const TIEMPO_LIMITE_ENVIO_MS = 15_000

/* Los dos tiempos de la búsqueda de equipos.
   El retardo es lo que convierte "una petición por tecla" en "una petición por
   pausa al escribir": con 300 ms, teclear «Los Panditas» son 1 o 2 llamadas y no
   12. Más corto se nota poco; más largo se siente lento.
   El techo es de 4 s, deliberadamente más corto que los 15 s del envío y del
   mismo orden que los 5 s del Riot ID: esto corre MIENTRAS alguien escribe, así
   que una búsqueda colgada tiene que rendirse rápido y dejar el campo libre. */
const RETARDO_BUSQUEDA_MS = 300
const TIEMPO_LIMITE_BUSQUEDA_MS = 4_000

/* Con menos de 2 caracteres no se busca: una sola letra trae ruido —la similitud
   difusa empareja casi todo— y gasta una petición por cada equipo del sistema. */
const MIN_TERMINO_BUSQUEDA = 2

/* ------------------------------------------------------------------ */
/*  Piezas de UI reutilizables (a nivel de módulo para no remontar los  */
/*  inputs en cada render y no perder el foco al escribir)              */
/* ------------------------------------------------------------------ */

/* Sin padding derecho: lo pone CampoTexto según haya o no adorno a la derecha. */
const CLASE_INPUT_BASE =
  'w-full pl-12 py-3.5 bg-black/40 backdrop-blur-sm border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-1 transition-all'
const CLASE_INPUT_OK = 'border-white/10 focus:border-blue-500 focus:ring-blue-500/30'
const CLASE_INPUT_ERROR = 'border-rose-500/60 focus:border-rose-400 focus:ring-rose-500/30'

function MensajeError({ id, texto }: { id: string; texto: string }) {
  return (
    <p id={id} className="mt-2 flex items-start gap-2 text-sm text-rose-300">
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{texto}</span>
    </p>
  )
}

type CampoTextoProps = {
  id: string
  label: string
  icono: LucideIcon
  valor: string
  onChange: (valor: string) => void
  error?: string
  tipo?: 'text' | 'email' | 'tel' | 'date'
  placeholder?: string
  autoComplete?: string
  min?: string
  max?: string
  claseContenedor?: string
  claseInput?: string
  /* id(s) que describen el input vía aria-describedby (p. ej. una ayuda de formato). */
  describedById?: string
  /* Al salir del campo. Lo usa el Riot ID para comprobarlo contra ATAK.GG. */
  onBlur?: () => void
  /* Adorno a la derecha del input (un estado de validación, por ejemplo). Va
     `aria-hidden`: es señal visual y lo que se anuncia lo dice quien lo pasa,
     por su propia región aria-live. */
  sufijo?: React.ReactNode
}

function CampoTexto({
  id, label, icono: Icono, valor, onChange, error,
  tipo = 'text', placeholder, autoComplete, min, max,
  claseContenedor = '', claseInput = '', describedById, onBlur, sufijo
}: CampoTextoProps) {
  const idError = `${id}-error`
  return (
    <div className={claseContenedor}>
      <label htmlFor={id} className="block text-sm text-gray-400 mb-2">
        {label} <span className="text-lqc-accent" aria-hidden="true">*</span>
      </label>
      <div className="relative">
        <Icono className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none ${error ? 'text-rose-400' : 'text-gray-500'}`} />
        <input
          id={id}
          name={id}
          type={tipo}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
          min={min}
          max={max}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={
            [describedById, error ? idError : null].filter(Boolean).join(' ') || undefined
          }
          className={`${CLASE_INPUT_BASE} ${sufijo ? 'pr-12' : 'pr-4'} ${error ? CLASE_INPUT_ERROR : CLASE_INPUT_OK} ${claseInput}`}
        />
        {sufijo && (
          <span
            className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center pointer-events-none"
            aria-hidden="true"
          >
            {sufijo}
          </span>
        )}
      </div>
      {error && <MensajeError id={idError} texto={error} />}
    </div>
  )
}

/* Píldora de radio: evita <select>, cuyos <option> nativos se pintan con los
   colores del sistema y rompen el tema oscuro. */
function OpcionPill({
  id, name, valor, seleccionado, onSelect, error
}: {
  id?: string
  name: string
  valor: string
  seleccionado: boolean
  onSelect: (valor: string) => void
  error: boolean
}) {
  return (
    <label className="cursor-pointer">
      <input
        id={id}
        type="radio"
        name={name}
        value={valor}
        checked={seleccionado}
        onChange={() => onSelect(valor)}
        className="peer sr-only"
      />
      {/* `peer-focus` y no `peer-focus-visible`: al mover el foco por código
          tras un envío fallido, Chrome no considera el foco "visible" y el
          anillo no llegaría a dibujarse. */}
      <span
        className={`
          flex items-center gap-3 px-4 py-3.5 rounded-xl border text-sm md:text-base transition-all duration-300
          peer-focus:ring-2 peer-focus:ring-lqc-accent/60 peer-focus:ring-offset-2 peer-focus:ring-offset-black
          ${seleccionado
            ? 'bg-lqc-900/50 border-lqc-accent/50 text-white shadow-lqc'
            : error
              ? 'bg-black/40 border-rose-500/50 text-gray-300 hover:border-rose-400/70'
              : 'bg-black/40 border-white/10 text-gray-300 hover:border-blue-500/40 hover:text-white'
          }
        `}
      >
        <span
          className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
            seleccionado ? 'border-lqc-accent' : 'border-white/25'
          }`}
        >
          {seleccionado && <span className="w-2 h-2 rounded-full bg-lqc-accent" />}
        </span>
        {valor}
      </span>
    </label>
  )
}

function TituloSeccion({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 mb-8">
      <div className="w-1.5 h-12 bg-gradient-to-t from-blue-600 to-blue-400 rounded-full" />
      <h2 className="text-2xl md:text-3xl font-light">{children}</h2>
    </div>
  )
}

const CLASE_TARJETA =
  'bg-black/30 backdrop-blur-sm border border-white/5 rounded-2xl p-6 md:p-8'

/* Enlace secundario de la página, relleno fantasma: las pastillas de comunidad del
   estado de éxito y la descarga del PDF en la tarjeta del reglamento. (Se llama
   «COMUNIDAD» por el primer uso, y el nombre se conserva porque tres archivos lo citan
   por nombre en sus comentarios —Reglamento.tsx, Contacto.tsx y Footer.tsx— para
   señalar el mismo patrón.) `after:hidden` desactiva la barra de gradiente que la regla
   base `a::after` de index.css dibuja en hover. */
const CLASE_ENLACE_COMUNIDAD =
  'after:hidden inline-flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl ' +
  'bg-black/40 border border-white/10 text-blue-300 ' +
  'hover:text-white hover:bg-blue-950/40 hover:border-blue-500/50 transition-all duration-300 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lqc-accent/60 ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-black'

/* Acción principal de la tarjeta del reglamento. NO lleva el gradiente del canon del
   CTA primario, y eso es deliberado: el CTA primario de esta página es «Registrarme»,
   el botón de envío a ancho completo que está dos secciones más abajo. Un segundo botón
   relleno con el mismo gradiente lo empata y deja de haber un solo camino obvio — la
   trampa que AGENTS.md documenta al revés (secundarios que se ven más vívidos que el
   primario).
   Así que queda un secundario reforzado: mismo esqueleto que CLASE_ENLACE_COMUNIDAD,
   pero con el borde y el texto en el acento para que gane a la descarga, que reutiliza
   ese secundario tal cual. Las dos van con `sm:flex-1` en el markup: sin eso el ancho lo
   pone el largo del texto y «Ver reglamento» quedaba MÁS ANGOSTO que «Descargar PDF
   (339 KB)», o sea la acción principal era la más chica de las dos.
   `after:hidden` desactiva la barra de gradiente que la regla base `a::after` de
   index.css dibuja en hover, y el color va explícito porque `a { color: #66a3ff }` de la
   misma capa base lo pisaría. `outline-hidden` y no `outline-none`: en Tailwind 4 el
   segundo es `outline-style: none`, que en modo de contraste forzado deja el foco sin
   ningún indicador, porque el `ring` es un box-shadow y ahí se descarta. */
const CLASE_VER_REGLAMENTO =
  'after:hidden inline-flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl ' +
  'bg-lqc-900/40 border border-lqc-accent/40 text-lqc-accent font-semibold ' +
  'hover:bg-blue-950/60 hover:border-lqc-accent hover:text-white transition-all duration-300 ' +
  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lqc-accent/60 ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-black'

/* Botón secundario de la página: el «Cambiar» de la elección de equipo y el reinicio
   del estado de éxito, que le suma `px-8 py-4 text-base` para el tamaño grande.
   `bg-none` desactiva el gradiente que la regla base de index.css le pone a TODO
   <button>: sin él se vería más vívido que el CTA de envío.
   `hover:[transform:none]` y `hover:shadow-none` matan el salto de -2px y el glow,
   que dentro de una tarjeta de datos se leen como jank. */
const CLASE_BOTON_SECUNDARIO =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-sans font-medium tracking-normal ' +
  'bg-none bg-black/50 border border-blue-800/40 text-gray-200 ' +
  'hover:bg-blue-950/40 hover:border-blue-600/60 hover:text-white ' +
  'transition-colors duration-200 hover:[transform:none] hover:shadow-none ' +
  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lqc-accent/60 ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-black'

/* ------------------------------------------------------------------ */
/*  Combobox de equipo                                                 */
/* ------------------------------------------------------------------ */

/* LA PIEZA CENTRAL DE ESTA PÁGINA, y la razón de que el registro individual pueda
   volver sin traer de vuelta el problema que lo mató: con el equipo como texto
   libre, «Los Panditas», «los panditas» y «Los Pandiats» eran tres equipos
   distintos en la base y nadie se enteraba hasta el día del torneo. Acá el equipo
   se RECONOCE en una lista en vez de escribirse de memoria, y lo que se manda
   cuando se elige uno es su `equipo_id`, no su nombre — así que el typo deja de
   ser posible por construcción, no por disciplina de quien escribe.

   Es un combobox de verdad (patrón ARIA 1.2 «combobox con listbox»), no un input
   con un div debajo:
   - el input lleva role="combobox", aria-expanded, aria-controls y
     aria-autocomplete="list";
   - la lista es un role="listbox" con role="option" adentro;
   - el foco NUNCA se va del input: la opción activa se marca con
     aria-activedescendant, que es lo que hace que un lector de pantalla anuncie
     «Los Panditas, 3 jugadores, 2 de 5» sin mover el cursor de teclado;
   - flechas para moverse, Enter para elegir, Escape para cerrar.
   La alternativa barata —un div con onClick— no la puede usar nadie que navegue
   con teclado o con lector, que es justamente quien más necesita no equivocarse
   de equipo.

   REGLA QUE NO SE NEGOCIA: la búsqueda NUNCA bloquea. Si la RPC falla, tarda o
   devuelve vacío, se sigue pudiendo escribir un nombre libre y enviar. Es la
   misma regla que la validación del Riot ID (ver src/lib/atak.ts) y por la misma
   razón de negocio: perder una inscripción porque una consulta de conveniencia no
   respondió es mucho peor que aceptar un equipo escrito a mano. */

type EstadoBusqueda = 'inactiva' | 'buscando' | 'lista' | 'fallida'

const ID_LISTBOX_EQUIPO = 'equipo-sugerencias'
const idOpcionEquipo = (indice: number) => `equipo-opcion-${indice}`

/* «3 jugadores» / «1 jugador». Se usa en la lista, en la tarjeta del equipo
   elegido y en la pantalla de éxito, así que vive en un solo lugar. */
function textoJugadores(cantidad: number): string {
  return `${cantidad} ${cantidad === 1 ? 'jugador' : 'jugadores'}`
}

function ComboboxEquipo({
  valor,
  elegido,
  error,
  creacionBloqueada,
  onTexto,
  onElegir,
  onDeshacer
}: {
  valor: string
  elegido: EquipoSugerido | null
  error?: string
  /* Se levanta con un rechazo 'torneo_lleno': la liga llegó a su tope de equipos, así
     que crear uno nuevo dejó de ser una salida y unirse a uno existente es la única
     que queda. Cambia los DOS textos que prometen lo contrario —la ayuda del campo y
     el mensaje de «no hay resultados»—, que si no quedan contradiciendo al error a dos
     líneas de distancia, y encima dentro del mismo `aria-describedby`: quien recibe el
     foco tras el rechazo escuchaba «no se pueden crear equipos nuevos» seguido de
     «escribe el nombre y lo creamos con tu inscripción». */
  creacionBloqueada: boolean
  onTexto: (valor: string) => void
  onElegir: (equipo: EquipoSugerido) => void
  onDeshacer: () => void
}) {
  const [sugerencias, setSugerencias] = useState<EquipoSugerido[]>([])
  const [estado, setEstado] = useState<EstadoBusqueda>('inactiva')
  const [abierto, setAbierto] = useState(false)
  /* Índice de la opción activa, o -1 si no hay ninguna. -1 y no `null` para poder
     sumarle y restarle sin ramas al mover con las flechas. */
  const [activo, setActivo] = useState(-1)
  /* Anuncio puntual que PISA al texto derivado de la región viva. Existe para los
     avisos que no se pueden derivar del estado de la búsqueda porque son respuesta a
     una acción concreta —hoy, intentar elegir un equipo lleno—. Se limpia en cuanto
     la búsqueda vuelve a cambiar de estado, para no quedar contradiciendo a la lista. */
  const [anuncio, setAnuncio] = useState('')

  const inputRef = useRef<HTMLInputElement>(null)
  const botonCambiarRef = useRef<HTMLButtonElement>(null)
  const temporizador = useRef<number | null>(null)
  /* Contador de peticiones: una respuesta cuyo id ya no es el último llegó tarde y
     se descarta. Sin esto, teclear «pan» y después «pandit» puede terminar con las
     sugerencias de «pan» pintadas encima de las de «pandit», que es peor que no
     tener sugerencias — le muestra a la persona un equipo que no buscó. */
  const peticiones = useRef(0)
  /* Las dos mitades del traspaso de foco entre las dos caras del campo. Elegir un
     equipo DESMONTA el input y montar la tarjeta; deshacer hace lo contrario. En los
     dos casos el nodo que tenía el foco desaparece y el foco cae a <body>, que en un
     formulario largo significa volver a tabular desde el principio del documento —y
     justo después de la acción más importante de la página—. Son banderas y no un
     `elegido ? ... : ...` en el efecto porque el foco solo debe moverse cuando el
     cambio lo produjo ESTE componente: si `equipoElegido` cambiara por otra vía, el
     combobox estaría robando el foco. */
  const volverAlInput = useRef(false)
  const irAlBotonCambiar = useRef(false)

  const idError = 'equipo-error'
  const idAyuda = 'equipo-ayuda'

  /* Limpieza del temporizador al desmontar. Sin esto, un debounce en vuelo cuando
     la página pasa al estado de éxito dispara una búsqueda sobre un componente que
     ya no existe. */
  useEffect(() => {
    return () => {
      if (temporizador.current !== null) window.clearTimeout(temporizador.current)
    }
  }, [])

  /* Con la lista scrolleable, mover con flechas tiene que arrastrar el scroll: el foco
     nunca sale del input (lo marca aria-activedescendant), así que el navegador no lo
     hace solo y la opción activa se puede quedar fuera de la vista.
     `block: 'nearest'` para que no salte cuando ya está visible. */
  useEffect(() => {
    if (!abierto || activo < 0) return
    document.getElementById(idOpcionEquipo(activo))?.scrollIntoView({ block: 'nearest' })
  }, [activo, abierto])

  /* Traspaso del foco entre las dos caras del campo. En un efecto y no en los
     handlers porque el nodo destino se monta recién en el render siguiente. */
  useEffect(() => {
    if (elegido) {
      if (!irAlBotonCambiar.current) return
      irAlBotonCambiar.current = false
      botonCambiarRef.current?.focus()
      return
    }
    if (!volverAlInput.current) return
    volverAlInput.current = false
    inputRef.current?.focus()
    /* Se selecciona el texto, que quedó igual al nombre del equipo que se acaba de
       soltar: así la primera tecla lo reemplaza en vez de agregarse al final. */
    inputRef.current?.select()
  }, [elegido])

  const buscar = (termino: string) => {
    const id = peticiones.current + 1
    peticiones.current = id
    setEstado('buscando')
    setAnuncio('')

    void (async () => {
      /* Sin credenciales el cliente viene en `null`. Es un fallo de búsqueda más:
         no bloquea nada, solo deja de haber sugerencias. */
      const supabase = obtenerSupabase()
      if (!supabase) {
        if (peticiones.current === id) setEstado('fallida')
        return
      }

      try {
        const { data, error: errorRpc } = await supabase
          .rpc('buscar_equipos', { termino })
          .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_BUSQUEDA_MS))

        /* Respuesta superada por otra más nueva: se tira sin tocar el estado. */
        if (peticiones.current !== id) return

        if (errorRpc) {
          setEstado('fallida')
          return
        }

        const lista = leerSugerencias(data)
        setSugerencias(lista)
        setEstado('lista')
        /* La lista se abre SOLO si el campo sigue enfocado. Sin esta condición, una
           respuesta lenta reabre el desplegable después de que la persona ya se fue al
           campo siguiente: queda flotando sobre la sección de abajo, con
           `aria-expanded="true"` en un combobox que no tiene el foco y sin ninguna
           forma de cerrarlo salvo volver a entrar y salir. Cubre también el Escape —
           cerrar a mano y que la respuesta lo deshiciera era la misma carrera. */
        setAbierto(lista.length > 0 && document.activeElement === inputRef.current)
        setActivo(-1)
      } catch {
        /* Red caída, aborto por timeout o cuerpo inesperado. Sin console.*: el
           invariante de cero salida por consola vale para todo src/. */
        if (peticiones.current !== id) return
        setEstado('fallida')
      }
    })()
  }

  /* El debounce se dispara desde el onChange —un evento— y no desde un efecto
     sobre `valor`. Es la diferencia entre "buscar porque la persona escribió" y
     "buscar porque el estado cambió": lo segundo también se dispararía cuando el
     valor lo cambia otro código (un reinicio del formulario, por ejemplo). */
  const alEscribir = (siguiente: string) => {
    onTexto(siguiente)
    setActivo(-1)

    cancelarBusquedaPendiente()
    /* Toda tecla invalida lo que esté en vuelo, no solo el borrado: si no, durante
       los 300 ms de debounce del término nuevo puede aterrizar la respuesta del
       anterior y abrir la lista con sugerencias que ya no corresponden a lo escrito. */
    peticiones.current += 1

    const termino = siguiente.trim()
    if (termino.length < MIN_TERMINO_BUSQUEDA) {
      setSugerencias([])
      setEstado('inactiva')
      setAbierto(false)
      return
    }

    temporizador.current = window.setTimeout(() => {
      temporizador.current = null
      buscar(termino)
    }, RETARDO_BUSQUEDA_MS)
  }

  /* Cancela el debounce pendiente y deja la ref en null, para que `!== null` siga
     significando "hay un timer vivo" y no "hubo uno alguna vez". */
  const cancelarBusquedaPendiente = () => {
    if (temporizador.current === null) return
    window.clearTimeout(temporizador.current)
    temporizador.current = null
  }

  const estaLleno = (equipo: EquipoSugerido) => equipo.jugadores >= MAX_JUGADORES

  const elegir = (equipo: EquipoSugerido) => {
    if (estaLleno(equipo)) {
      /* No se elige, pero se dice por qué: sin esto, con teclado, Enter sobre una
         opción llena no hace absolutamente nada y no hay forma de saber si la tecla
         se perdió o si el control está roto. */
      setAnuncio(`${equipo.nombre} está lleno: ya tiene ${MAX_JUGADORES} jugadores. Elige otro equipo.`)
      return
    }
    /* Cualquier búsqueda pendiente deja de importar: ya hay equipo. */
    cancelarBusquedaPendiente()
    peticiones.current += 1
    setAbierto(false)
    setActivo(-1)
    setSugerencias([])
    setEstado('inactiva')
    setAnuncio('')
    /* El foco tiene que seguir al control: el input se desmonta en este mismo
       cambio. Lo mueve el efecto, cuando el botón ya exista. */
    irAlBotonCambiar.current = true
    onElegir(equipo)
  }

  const alTeclado = (evento: React.KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === 'Escape') {
      setAbierto(false)
      setActivo(-1)
      return
    }

    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      if (sugerencias.length === 0) return
      /* preventDefault para que la flecha no mueva el cursor dentro del texto:
         con la lista abierta, las flechas son de la lista. */
      evento.preventDefault()

      if (!abierto) {
        setAbierto(true)
        setActivo(evento.key === 'ArrowDown' ? 0 : sugerencias.length - 1)
        return
      }

      const paso = evento.key === 'ArrowDown' ? 1 : -1
      setActivo((prev) => {
        const siguiente = prev + paso
        /* Circular: desde la última, abajo vuelve a la primera. Con 5 opciones
           como mucho, es más rápido que topar contra el extremo. */
        if (siguiente < 0) return sugerencias.length - 1
        if (siguiente >= sugerencias.length) return 0
        return siguiente
      })
      return
    }

    if (evento.key === 'Enter') {
      /* Sin opción activa, Enter NO se toca: es el envío del formulario. Solo se
         intercepta cuando hay algo que elegir, que es lo que la persona espera
         que haga Enter en ese momento. */
      if (!abierto || activo < 0) return
      const opcion = sugerencias[activo]
      if (!opcion) return
      evento.preventDefault()
      /* Una opción llena no se elige, pero el Enter igual se consume: si se dejara
         pasar, el formulario se enviaría desde una lista abierta y la persona no
         entendería por qué. */
      elegir(opcion)
    }
  }

  /* ---------- Equipo ya elegido ---------- */
  if (elegido) {
    return (
      <div>
        {/* El <label> no envuelve a nada enfocable en este estado, así que es un
            <p>: un label sin control asociado es ruido para un lector de pantalla. */}
        <p className="block text-sm text-gray-400 mb-2">
          Tu equipo <span className="text-lqc-accent" aria-hidden="true">*</span>
        </p>
        <div
          className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5 ${
            error ? 'border-rose-500/60 bg-rose-950/20' : 'border-lqc-accent/40 bg-lqc-900/30'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Check className="w-5 h-5 text-lqc-accent shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-white font-medium truncate">{elegido.nombre}</p>
              <p className="text-sm text-gray-400">{textoJugadores(elegido.jugadores)}</p>
            </div>
          </div>
          {/* Lleva `id="equipo"` porque en este estado ÉSTE es el control del campo
              equipo: es a donde tiene que ir el foco cuando el servidor rechaza por
              'equipo_lleno'. `enfocarClave` busca el id que coincide con la clave de
              error, así que si el id viviera solo en el input de arriba, el foco se
              perdería en silencio justo en el rechazo que más lo necesita. */}
          <button
            type="button"
            id="equipo"
            ref={botonCambiarRef}
            onClick={() => {
              volverAlInput.current = true
              /* Se relanza la búsqueda con el texto que queda —que es el nombre del
                 equipo que se acaba de soltar—, para que la lista vuelva a aparecer con
                 ese equipo arriba. Sin esto, deshacer deja el campo con el nombre EXACTO
                 y sin sugerencias: enviar sin tocar nada manda `equipo` (nombre libre)
                 en vez de `equipo_id`, o sea que crea un segundo equipo con el mismo
                 nombre — exactamente el duplicado que este combobox existe para evitar.
                 El foco vuelve al input en el efecto, así que para cuando llegue la
                 respuesta el guard de `document.activeElement` ya se cumple. */
              const termino = valor.trim()
              if (termino.length >= MIN_TERMINO_BUSQUEDA) {
                cancelarBusquedaPendiente()
                buscar(termino)
              }
              onDeshacer()
            }}
            aria-label={`Cambiar de equipo. Ahora está elegido ${elegido.nombre}`}
            aria-describedby={error ? idError : undefined}
            className={`${CLASE_BOTON_SECUNDARIO} shrink-0`}
          >
            Cambiar
          </button>
        </div>
        {error && <MensajeError id={idError} texto={error} />}
        <p className="mt-2 text-sm text-gray-400">
          Te vas a registrar en este equipo. Si no es el tuyo, pulsa «Cambiar».
        </p>
      </div>
    )
  }

  /* ---------- Buscando o escribiendo ---------- */
  const hayLista = abierto && sugerencias.length > 0
  const sinResultados =
    estado === 'lista' && sugerencias.length === 0 && valor.trim().length >= MIN_TERMINO_BUSQUEDA

  return (
    <div>
      <label htmlFor="equipo" className="block text-sm text-gray-400 mb-2">
        Tu equipo <span className="text-lqc-accent" aria-hidden="true">*</span>
      </label>

      {/* `relative` para colgar la lista, y sin `overflow-hidden` en ningún padre
          de esta caja o la lista quedaría recortada. */}
      <div className="relative">
        <Users
          className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none ${
            error ? 'text-rose-400' : 'text-gray-500'
          }`}
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          id="equipo"
          name="equipo"
          type="text"
          role="combobox"
          value={valor}
          onChange={(e) => alEscribir(e.target.value)}
          onKeyDown={alTeclado}
          /* Al salir del campo se cierra la lista. Que las opciones no roben el
             foco lo resuelve el onMouseDown de más abajo, no un timeout. */
          onBlur={() => {
            setAbierto(false)
            setActivo(-1)
          }}
          placeholder="Escribe el nombre de tu equipo"
          /* `off` y no `organization`: lo que el navegador tiene guardado de otros
             formularios no tiene nada que ver con los equipos de esta liga, y una
             lista de autocompletado nativa taparía a las sugerencias reales. */
          autoComplete="off"
          required
          aria-expanded={hayLista}
          aria-controls={ID_LISTBOX_EQUIPO}
          aria-autocomplete="list"
          aria-activedescendant={
            hayLista && activo >= 0 ? idOpcionEquipo(activo) : undefined
          }
          aria-invalid={error ? true : undefined}
          aria-describedby={`${idAyuda}${error ? ` ${idError}` : ''}`}
          className={`${CLASE_INPUT_BASE} pr-12 ${error ? CLASE_INPUT_ERROR : CLASE_INPUT_OK}`}
        />
        {estado === 'buscando' && (
          <span
            className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center pointer-events-none"
            aria-hidden="true"
          >
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </span>
        )}

        {/* La lista se oculta DESMONTÁNDOLA, así una lista cerrada no deja opciones
            navegables por lector de pantalla. Eso deja a `aria-controls` apuntando a un
            id ausente, que en general es ARIA inválido —es la razón por la que
            ListaInscripciones.tsx mantiene su panel en el DOM con `hidden` en vez de
            desmontarlo—, pero acá no lo es: el patrón combobox contempla exactamente
            este caso mientras `aria-expanded` sea `false`, que es lo que garantiza
            `hayLista`. Si alguna vez `aria-expanded` deja de seguir a la presencia de la
            lista, este razonamiento se cae y hay que volver al `hidden`.
            `onMouseDown` con preventDefault es lo que hace que un clic en una
            opción NO dispare el blur del input antes del click: sin eso, el blur
            cierra la lista y el click nunca llega a su destino. Es el truco
            estándar del patrón, y es preferible a un setTimeout en el blur porque
            no depende de que el click gane una carrera.
            `max-h` + scroll: cinco opciones miden más que el espacio libre de un
            teléfono con el teclado abierto, y las últimas quedaban debajo del teclado
            sin forma de alcanzarlas con el dedo (con flechas sí, pero en móvil no hay). */}
        {hayLista && (
          <ul
            id={ID_LISTBOX_EQUIPO}
            role="listbox"
            aria-label="Equipos que coinciden"
            onMouseDown={(e) => e.preventDefault()}
            className="absolute z-20 mt-2 w-full max-h-72 overflow-y-auto rounded-xl border border-blue-800/40 bg-gray-950/95 backdrop-blur-md shadow-lqc-lg"
          >
            {sugerencias.map((equipo, indice) => {
              const lleno = estaLleno(equipo)
              const esActivo = indice === activo
              return (
                <li
                  key={equipo.id}
                  id={idOpcionEquipo(indice)}
                  role="option"
                  aria-selected={esActivo}
                  /* `aria-disabled` y no quitarlo de la lista: que un equipo lleno
                     aparezca y se explique es información —«ya somos 7»—, mientras
                     que esconderlo dejaría a la persona buscándolo para siempre y
                     probablemente creando un equipo duplicado con el mismo nombre,
                     que es exactamente lo que este combobox existe para evitar.
                     Sigue siendo navegable con flechas a propósito: así un lector
                     de pantalla lo anuncia y su motivo se escucha. */
                  aria-disabled={lleno || undefined}
                  onClick={() => elegir(equipo)}
                  className={`flex items-center justify-between gap-3 px-4 py-3 cursor-pointer border-b border-white/5 last:border-b-0 ${
                    lleno
                      ? 'cursor-not-allowed opacity-60'
                      : esActivo
                        ? 'bg-lqc-900/60'
                        : 'hover:bg-blue-950/40'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-white truncate">{equipo.nombre}</span>
                    <span className="block text-sm text-gray-400">
                      {textoJugadores(equipo.jugadores)}
                    </span>
                  </span>
                  {lleno && (
                    <span className="shrink-0 rounded-full border border-rose-500/40 bg-rose-950/30 px-2.5 py-1 text-xs text-rose-200">
                      Equipo lleno
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {error && <MensajeError id={idError} texto={error} />}

      {/* La ayuda es lo que de verdad se lee tras un rechazo: el foco cae en este campo,
          que está al principio del formulario, mientras que el banner con la explicación
          larga vive junto al botón de envío, a una pantalla o más de distancia. Por eso
          acá va lo accionable completo cuando la creación está bloqueada, en vez de
          confiar en que alguien baje a leer el banner. */}
      <p id={idAyuda} className="mt-2 text-sm text-gray-400">
        {creacionBloqueada ? (
          <>
            El torneo llegó a su máximo de {MAX_EQUIPOS} equipos, así que por ahora no se
            pueden crear equipos nuevos.{' '}
            <span className="text-white font-medium">Unirte a uno ya inscrito sí:</span>{' '}
            borra la última letra del nombre para que vuelvan a aparecer las sugerencias
            y elige tu equipo ahí.
          </>
        ) : (
          <>
            Escribe y elige tu equipo de la lista para no crear uno repetido. Si todavía
            no está registrado, escribe el nombre y lo creamos con tu inscripción.
          </>
        )}
      </p>

      {/* Región viva del estado de la búsqueda. Va aparte de la ayuda porque es lo
          único que cambia solo, sin que la persona haya hecho nada: sin esto, quien
          no ve la pantalla no se entera de que aparecieron cinco sugerencias.
          `polite` para no interrumpir mientras se escribe.
          El caso 'fallida' se anuncia con lo que hay que hacer, no con lo que pasó:
          la búsqueda es una comodidad y su fallo no cambia lo que la persona puede
          hacer a continuación.
          El primer caso se ata a `hayLista` y no a `estado`: la lista puede estar
          cerrada con sugerencias cargadas —tras un Escape, o cuando la respuesta llega
          con el foco en otro campo— y decir «usa las flechas para elegir» sobre un
          desplegable que no está abierto manda a la persona a teclas que no hacen nada. */}
      <span role="status" aria-live="polite" className="sr-only">
        {anuncio ||
          (hayLista
            ? `${sugerencias.length} ${
                sugerencias.length === 1 ? 'equipo encontrado' : 'equipos encontrados'
              }. Usa las flechas para elegir.`
            : sinResultados
              ? creacionBloqueada
                ? 'No hay equipos con ese nombre, y con el torneo completo no se puede crear uno nuevo.'
                : 'No hay equipos con ese nombre. Puedes escribirlo y lo creamos.'
              : estado === 'fallida'
                ? 'No pudimos buscar equipos. Escribe el nombre completo y sigue adelante.'
                : '')}
      </span>

      {/* Los dos mensajes visibles equivalentes. El de búsqueda fallida no bloquea ni
          pinta el campo como error: escribir el nombre a mano sigue siendo una salida
          válida y completa. El de «sin resultados» sí cambia de sentido con la liga
          llena, porque ahí esa salida dejó de existir. */}
      {sinResultados && (
        <p className="mt-2 text-sm text-gray-400">
          {creacionBloqueada
            ? 'No hay ningún equipo con ese nombre, y con el torneo completo no se puede crear uno nuevo. Revisa cómo se escribe el nombre de tu equipo.'
            : 'No hay ningún equipo con ese nombre. Se creará al enviar tu registro.'}
        </p>
      )}
      {estado === 'fallida' && (
        <p className="mt-2 text-sm text-amber-200/80">
          No pudimos cargar las sugerencias. Puedes escribir el nombre completo de tu
          equipo y continuar: tu registro se envía igual.
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Página                                                             */
/* ------------------------------------------------------------------ */

export default function Registro() {
  const [form, setForm] = useState<FormState>(FORM_VACIO)
  /* El equipo elegido de las sugerencias, o null si el nombre es texto libre. Es
     lo que decide cuál de las dos claves lleva el payload — `equipo_id` o
     `equipo`— y no se puede derivar del texto: dos equipos pueden llamarse
     parecido y solo el id dice a cuál se une la persona. */
  const [equipoElegido, setEquipoElegido] = useState<EquipoSugerido | null>(null)
  const [esCapitan, setEsCapitan] = useState(false)
  const [errores, setErrores] = useState<Errores>({})
  const [aceptaPrivacidad, setAceptaPrivacidad] = useState(false)
  const [enviando, setEnviando] = useState(false)
  /* Bandera, no el error real: el mensaje que se muestra es literal en el JSX,
     así que ningún detalle técnico del backend puede filtrarse a la pantalla. */
  const [errorEnvio, setErrorEnvio] = useState(false)
  /* Rechazo de negocio de la RPC. Separado de `errorEnvio` (fallo técnico) y de
     `errores` (validación local) porque los tres significan cosas distintas y
     mezclarlos haría aparecer el banner equivocado. */
  const [rechazo, setRechazo] = useState<CodigoRechazo | null>(null)
  /* Resultado del registro. Reemplaza al booleano `enviado` del modelo anterior:
     la pantalla de éxito ya no puede armarse solo con lo que hay en el formulario
     —el número de jugadores del equipo lo sabe la base, no el cliente—, así que el
     estado guarda lo que la RPC devolvió. `null` = todavía no se envió. */
  const [resultado, setResultado] = useState<RegistroOk | null>(null)
  /* Nombre del equipo al que se entró, capturado en el envío. Se guarda aparte
     porque `reiniciar()` limpia el formulario y la pantalla de éxito tiene que
     seguir diciendo a qué equipo se unió la persona. */
  const [equipoRegistrado, setEquipoRegistrado] = useState('')

  const tituloExitoRef = useRef<HTMLHeadingElement>(null)
  const tarjetaExitoRef = useRef<HTMLDivElement>(null)
  const enviadoPrevio = useRef(false)

  /* --- Comprobación del Riot ID contra ATAK.GG (ver src/lib/atak.ts) --- */

  /* Un solo Riot ID por envío, así que el estado vuelve a ser escalar. En el
     modelo del roster esto era un diccionario por uid con N comprobaciones en
     vuelo; con un jugador por formulario, esa maquinaria sobra entera. */
  const [validacionRiot, setValidacionRiot] = useState<ValidacionRiotId>(VALIDACION_INACTIVA)
  const [anuncioRiot, setAnuncioRiot] = useState('')

  /* Contador de peticiones: una respuesta cuyo id ya no es el último llegó tarde
     y se descarta. */
  const peticionesRiot = useRef(0)

  /* Caché de veredictos FIRMES, keyeado por el valor del Riot ID. Los
     'indeterminado' NO se guardan a propósito: si ATAK o Riot estaban caídos, el
     siguiente blur es una oportunidad legítima de reintentar. */
  const riotIdComprobado = useRef<Map<string, ResultadoRiotId>>(new Map())

  /* Estado efectivo: el veredicto guardado solo vale si sigue siendo sobre el Riot
     ID que hay escrito AHORA. Cualquier otra cosa se lee como 'inactivo', que es
     el estado que no dice ni bloquea nada. */
  const estadoRiot: EstadoRiotId =
    validacionRiot.valor === form.gamertag.trim() ? validacionRiot.estado : 'inactivo'

  /* Foco + scroll a un control por su clave de error. `preventScroll` separa las
     dos cosas para que el scroll sea suave y el foco instantáneo. */
  const enfocarClave = (clave: string) => {
    const elemento = document.getElementById(clave)
    if (!elemento) return
    elemento.focus({ preventScroll: true })
    elemento.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  /* Cada vez que se alterna formulario ⇄ éxito, el nodo que tenía el foco se
     desmonta y el foco cae en <body>. Se compara contra el valor previo en vez de
     usar una bandera de "primer render": así la página no roba el foco al cargar y
     es inmune al doble montaje de StrictMode. */
  const enviado = resultado !== null
  useEffect(() => {
    if (enviadoPrevio.current === enviado) return
    enviadoPrevio.current = enviado

    if (enviado) {
      tituloExitoRef.current?.focus({ preventScroll: true })
      tarjetaExitoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    enfocarClave('equipo')
  }, [enviado])

  /* Foco tras un rechazo de la RPC. En un efecto y no en `handleSubmit` porque el
     destino puede no estar montado todavía en el momento de la respuesta. */
  useEffect(() => {
    if (!rechazo) return
    enfocarClave(CAMPO_DE_RECHAZO[rechazo])
  }, [rechazo])

  /* --- Escrituras del formulario --- */

  const limpiarError = (clave: string) => {
    setErrores((prev) => {
      if (!prev[clave]) return prev
      const siguiente = { ...prev }
      delete siguiente[clave]
      return siguiente
    })
  }

  const setCampo = (campo: CampoForm, valor: string) => {
    setForm((prev) => ({ ...prev, [campo]: valor }))
    limpiarError(campo)
    /* Tocar el campo que un rechazo del servidor señalaba lo descarta: era sobre
       el valor anterior. Sin esto, el aviso de «ese equipo está lleno» seguiría en
       pantalla mientras se escribe el nombre de otro equipo. */
    if (rechazo && CAMPO_DE_RECHAZO[rechazo] === campo) setRechazo(null)
  }

  /* Escolaridad y Género: al salir de "Otros" se descarta el texto libre. */
  const setOpcion = (campo: 'escolaridad' | 'genero', valor: string) => {
    const campoOtro: CampoForm = campo === 'escolaridad' ? 'escolaridad_otro' : 'genero_otro'
    setForm((prev) => ({
      ...prev,
      [campo]: valor,
      ...(valor !== 'Otros' ? { [campoOtro]: '' } : {})
    }))
    setErrores((prev) => {
      const siguiente = { ...prev }
      delete siguiente[campo]
      if (valor !== 'Otros') delete siguiente[campoOtro]
      return siguiente
    })
  }

  /* Toda edición del Riot ID invalida el veredicto anterior —era sobre otro valor—
     y descarta la respuesta de una validación en vuelo. */
  const setGamertag = (valor: string) => {
    setCampo('gamertag', valor)
    peticionesRiot.current += 1
    /* Se limpia el veredicto guardado aunque el estado esté atado al valor: si la
       persona edita y vuelve a teclear el MISMO texto que se estaba comprobando, el
       valor coincide de nuevo pero aquella petición ya quedó descartada por el
       contador y su respuesta nunca se va a aplicar — sin esto, el indicador de
       "Validando…" giraba para siempre. No se pierde nada: al salir del campo, el
       caché repinta el veredicto sin volver a llamar. */
    setValidacionRiot(VALIDACION_INACTIVA)
    setAnuncioRiot('')
  }

  /* --- Elección de equipo --- */

  const elegirEquipo = (equipo: EquipoSugerido) => {
    setEquipoElegido(equipo)
    /* El texto se sincroniza con el nombre elegido: es lo que se manda si la
       persona después deshace la elección y envía igual, y es lo que ve si vuelve
       al campo. */
    setForm((prev) => ({ ...prev, equipo: equipo.nombre }))
    limpiarError('equipo')
    if (rechazo && CAMPO_DE_RECHAZO[rechazo] === 'equipo') setRechazo(null)
  }

  /* Deshacer NO borra el texto a propósito: quien pulsa «Cambiar» casi siempre
     quiere ver la lista otra vez —se equivocó de equipo entre dos nombres
     parecidos—, y vaciar el campo lo obligaría a escribirlo todo de nuevo.
     El riesgo del texto que queda es real y conocido: si se envía tal cual, viaja
     como `equipo` (nombre libre) y no como `equipo_id`. Por eso la ayuda del campo
     insiste en elegir de la lista, y por eso al deshacer el foco vuelve al input
     con las sugerencias a un carácter de distancia. */
  const deshacerEquipo = () => {
    setEquipoElegido(null)
    if (rechazo && CAMPO_DE_RECHAZO[rechazo] === 'equipo') setRechazo(null)
  }

  /* El texto del combobox pasa por acá y no por `setCampo` directo porque escribir
     a mano después de haber elegido significa que la elección ya no vale: el id
     guardado apuntaría a un equipo cuyo nombre ya no es el que se ve en pantalla. */
  const setTextoEquipo = (valor: string) => {
    setCampo('equipo', valor)
    if (equipoElegido) setEquipoElegido(null)
  }

  /* --- Comprobación remota del Riot ID --- */

  /* Traduce el veredicto a lo que ve y oye la persona, siempre atado al valor que
     se comprobó. Es el único lugar donde 'indeterminado' se vuelve silencio: ni
     tilde, ni error, ni anuncio. Es la regla más importante de todo esto —una
     validación que no se pudo hacer nunca frena una inscripción— y por eso vive en
     una sola rama.

     Ojo con lo que NO hace: no escribe en `errores`. Ese objeto significa "lo que
     encontró el último envío" y es lo que enciende el banner de abajo. */
  const aplicarVeredicto = (valor: string, resultadoRiot: ResultadoRiotId) => {
    if (resultadoRiot === 'existe') {
      setValidacionRiot({ valor, estado: 'valido' })
      setAnuncioRiot('Riot ID verificado.')
      return
    }
    if (resultadoRiot === 'no_existe') {
      setValidacionRiot({ valor, estado: 'no_encontrado' })
      setAnuncioRiot(MENSAJE_RIOT_ID_NO_EXISTE)
      return
    }
    setValidacionRiot({ valor, estado: 'inactivo' })
    setAnuncioRiot('')
  }

  /* Al salir del campo, no en cada tecla: es una petición de red por comprobación.
     La comprobación es ORIENTATIVA, no una barrera: con Enter dentro del campo el
     formulario se envía sin que haya blur, así que nunca corre. Es coherente con no
     bloquear nunca por la validación, pero significa que no todo lo que se manda
     pasó por acá. No asumir lo contrario. */
  const comprobarRiotId = (valorCrudo: string) => {
    const valor = valorCrudo.trim()

    /* El formato local manda y corre primero: si ya está mal, su error es más
       accionable que cualquier respuesta remota y no se gasta una petición. */
    if (!valor || !REGEX_RIOT_ID.test(valor)) return

    const cacheado = riotIdComprobado.current.get(valor)
    if (cacheado) {
      aplicarVeredicto(valor, cacheado)
      return
    }

    const idPeticion = peticionesRiot.current + 1
    peticionesRiot.current = idPeticion
    setValidacionRiot({ valor, estado: 'validando' })
    setAnuncioRiot('')

    /* Sin await ni try/catch: validarRiotId() no lanza por contrato y esto no debe
       bloquear nada de lo que la persona siga haciendo en el formulario. */
    void (async () => {
      const resultadoRiot = await validarRiotId(valor)
      if (peticionesRiot.current !== idPeticion) return
      if (resultadoRiot !== 'indeterminado') {
        riotIdComprobado.current.set(valor, resultadoRiot)
      }
      aplicarVeredicto(valor, resultadoRiot)
    })()
  }

  /* --- Validación --- */

  const validar = (): Errores => {
    const e: Errores = {}

    /* El equipo vale si se eligió uno de la lista O si hay texto escrito. Se mira
       el texto y no solo la elección porque crear un equipo nuevo es un camino de
       primera clase, no un caso raro: el primero de cada equipo en registrarse
       siempre pasa por ahí. */
    if (!equipoElegido && !form.equipo.trim()) {
      e.equipo = 'Elige tu equipo de la lista o escribe el nombre.'
    }

    const gamertag = form.gamertag.trim()
    if (!gamertag) {
      e.gamertag = 'Escribe tu Riot ID.'
    } else if (!REGEX_RIOT_ID.test(gamertag)) {
      e.gamertag =
        'Riot ID completo, con nombre y tag: nombre#tag (por ejemplo, Jugador#MX1).'
    } else if (estadoRiot === 'no_encontrado') {
      /* El veredicto remoto se suma acá y no aparte: solo si el formato ya pasó.
         Ante los dos problemas, el de formato es el más accionable.
         Lo que NO frena el envío, a propósito: una comprobación en vuelo
         ('validando') y una que no se pudo hacer ('inactivo'). */
      e.gamertag = MENSAJE_RIOT_ID_NO_EXISTE
    }

    if (!form.nombre.trim()) e.nombre = 'Escribe tu nombre completo.'

    const hoy = fechaLocalISO(new Date())
    const maxNacimiento = fechaMaximaNacimiento()
    const minNacimiento = fechaMinimaNacimiento()

    /* Orden de ramas: de lo más específico a lo más general, para que cada caso
       dé su propio mensaje. El piso va último: un año tecleado a medias ("0206")
       cae ahí y el mensaje apunta al año, no a la edad. */
    if (!form.fecha_nacimiento) {
      e.fecha_nacimiento = 'Selecciona tu fecha de nacimiento.'
    } else if (form.fecha_nacimiento > hoy) {
      e.fecha_nacimiento = 'La fecha no puede ser futura.'
    } else if (form.fecha_nacimiento > maxNacimiento) {
      e.fecha_nacimiento = `Debes tener al menos ${EDAD_MINIMA} años cumplidos.`
    } else if (form.fecha_nacimiento < minNacimiento) {
      e.fecha_nacimiento = 'Revisa el año de nacimiento.'
    }

    const errorCelular = validarTelefono(form.celular, 'Escribe tu número de celular.')
    if (errorCelular) e.celular = errorCelular

    if (!form.correo.trim()) {
      e.correo = 'Escribe tu correo electrónico.'
    } else if (!REGEX_CORREO.test(form.correo.trim())) {
      e.correo = 'El correo no tiene un formato válido (ejemplo: nombre@correo.com).'
    }

    if (!form.municipio.trim()) e.municipio = 'Escribe tu municipio.'

    if (!form.escolaridad) e.escolaridad = 'Selecciona tu escolaridad.'
    if (form.escolaridad === 'Otros' && !form.escolaridad_otro.trim()) {
      e.escolaridad_otro = 'Especifica la escolaridad.'
    }

    if (!form.genero) e.genero = 'Selecciona tu género.'
    if (form.genero === 'Otros' && !form.genero_otro.trim()) {
      e.genero_otro = 'Especifica el género.'
    }

    /* `es_capitan` NO se valida y no tiene error posible: es opcional por diseño.
       Si nadie de un equipo la marca, la organización toma al primero que se
       registró. Una advertencia acá ("nadie es capitán todavía") sería falsa —esta
       página no puede saber si alguien más del equipo ya la marcó, porque el
       cliente anónimo no lee las tablas— y le pediría a la persona que resuelva
       algo que no está en sus manos. */

    if (!aceptaPrivacidad) {
      e.privacidad = 'Debes aceptar el aviso de privacidad para continuar.'
    }

    return e
  }

  /* --- Envío --- */

  const handleSubmit = async (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault()

    /* Segunda barrera contra el doble envío (la primera es `disabled` en el
       botón): cubre un submit disparado con Enter mientras la llamada vuela. */
    if (enviando) return

    const nuevosErrores = validar()
    setErrores(nuevosErrores)
    setErrorEnvio(false)
    setRechazo(null)

    if (Object.keys(nuevosErrores).length > 0) {
      const primera = ORDEN_CLAVES.find((clave) => nuevosErrores[clave])
      if (primera) enfocarClave(primera)
      return
    }

    /* Escolaridad y Género se mandan resueltos: si se eligió "Otros", el valor
       final es el texto especificado, no la etiqueta genérica. El celular va
       normalizado a 10 dígitos, sin separadores. */
    const base: PayloadBase = {
      gamertag: form.gamertag.trim(),
      nombre: form.nombre.trim(),
      fecha_nacimiento: form.fecha_nacimiento,
      celular: soloDigitos(form.celular),
      correo: form.correo.trim(),
      municipio: form.municipio.trim(),
      escolaridad: form.escolaridad === 'Otros' ? form.escolaridad_otro.trim() : form.escolaridad,
      genero: form.genero === 'Otros' ? form.genero_otro.trim() : form.genero,
      es_capitan: esCapitan
    }

    /* Una clave o la otra, nunca las dos: el `equipo_id` de una elección real gana
       siempre al texto, que en ese caso es solo lo que se ve en pantalla. */
    const payload: PayloadRegistro = equipoElegido
      ? { ...base, equipo_id: equipoElegido.id }
      : { ...base, equipo: form.equipo.trim() }

    /* El nombre que va a ver la persona en la pantalla de éxito. Sale de la
       elección cuando la hubo —es el nombre canónico, tal como está en la base— y
       del texto cuando el equipo se está creando. */
    const nombreEquipo = equipoElegido ? equipoElegido.nombre : form.equipo.trim()

    setEnviando(true)
    try {
      /* Sin credenciales de Supabase el cliente viene en `null` (el build salió sin
         las VITE_*). Es un fallo de envío más: mismo banner genérico. */
      const supabase = obtenerSupabase()
      if (!supabase) {
        setErrorEnvio(true)
        return
      }

      /* Todo el registro entra por esta RPC: es la única superficie de escritura
         que el cliente anónimo puede tocar. NO se intenta un `.select()` de vuelta
         —la RLS no le da lectura sobre `equipos` ni `jugadores`— y no hace falta:
         la función devuelve el veredicto y el `orden` en su valor de retorno.
         El `abortSignal` corta a los 15 s: sin él, un backend colgado deja el botón
         en "Enviando…" hasta el timeout del navegador. El aborto vuelve como
         `error` en la respuesta, así que cae en la misma rama de abajo. */
      const { data, error } = await supabase
        .rpc('registrar_jugador', { datos: payload })
        .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_ENVIO_MS))

      if (error) {
        setErrorEnvio(true)
        return
      }

      const respuesta = leerRespuesta(data)

      if (respuesta.tipo === 'ok') {
        setEquipoRegistrado(nombreEquipo)
        setResultado(respuesta.datos)
        return
      }

      /* Una respuesta que no se entiende se trata como fallo genérico: es lo único
         honesto que se puede decir de algo que no sabemos leer. */
      if (respuesta.tipo === 'desconocido') {
        setErrorEnvio(true)
        return
      }

      /* El foco lo mueve el efecto de `[rechazo]`: acá el destino todavía no está
         renderizado ni necesariamente habilitado. */
      setRechazo(respuesta.tipo)
    } catch {
      /* Fallo de red o de configuración. No se captura el error ni se registra en
         consola: el payload son datos personales y el mensaje al usuario es
         genérico a propósito. */
      setErrorEnvio(true)
    } finally {
      /* En `finally` para que un fallo de red no deje el botón trabado. */
      setEnviando(false)
    }
  }

  /* Reinicio COMPLETO, equipo incluido. Se podría conservar el equipo elegido para
     encadenar registros del mismo roster en un mismo teléfono, y es tentador —en
     un evento presencial pasa—, pero el consentimiento de privacidad de abajo está
     en primera persona: quien lo marca acepta el tratamiento de SUS datos. Dejar
     el formulario a medio llenar para la persona siguiente invita justo a lo que
     ese texto ya no cubre. Volver a elegir el equipo cuesta dos letras y una
     flecha. */
  const reiniciar = () => {
    /* OJO: acá no se limpia el estado INTERNO del combobox (sus sugerencias, si
       está abierto, la opción activa). No hace falta porque la pantalla de éxito
       reemplaza el <form> entero, así que `ComboboxEquipo` se desmonta y vuelve a
       montarse limpio. Es implícito y frágil: si alguna vez el éxito pasa a ser un
       overlay sobre el formulario en vez de reemplazarlo, este reinicio deja las
       sugerencias del registro anterior y nadie se entera. */
    setForm(FORM_VACIO)
    setEquipoElegido(null)
    setEsCapitan(false)
    setErrores({})
    setAceptaPrivacidad(false)
    setErrorEnvio(false)
    setRechazo(null)
    setResultado(null)
    setEquipoRegistrado('')
    /* El estado del Riot ID también se limpia, para que una comprobación del
       registro anterior que llegue tarde no pinte su veredicto sobre el formulario
       nuevo. El contador se INCREMENTA en vez de volver a cero: si se reiniciara, una
       respuesta en vuelo podría volver a coincidir con el `idPeticion` del formulario
       siguiente, pasar el guard y pintar un veredicto que no es de este registro.
       El caché de veredictos por VALOR sobrevive a propósito: sigue siendo cierto. */
    peticionesRiot.current += 1
    setValidacionRiot(VALIDACION_INACTIVA)
    setAnuncioRiot('')
  }

  /* --- Derivados de render --- */

  const hayErrores = Object.keys(errores).length > 0

  /* Error del control «equipo» o del Riot ID derivado del rechazo del servidor.
     Derivado y no guardado en `errores` por lo mismo que el veredicto del Riot ID:
     ese objeto enciende el banner de validación local, que acá no corresponde —el
     formulario estaba bien, lo rechazó la base—. */
  const campoRechazado = rechazo ? CAMPO_DE_RECHAZO[rechazo] : null
  const errorEquipoServidor =
    campoRechazado === 'equipo' && rechazo ? MENSAJE_RECHAZO_CAMPO[rechazo] : undefined
  const errorGamertagServidor =
    campoRechazado === 'gamertag' && rechazo ? MENSAJE_RECHAZO_CAMPO[rechazo] : undefined

  /* Lo que la pantalla de éxito puede afirmar, todo derivado del `orden` que
     devolvió la RPC —ningún número inventado del lado del cliente—:
     cuántos son ahora, si ya llegaron al mínimo y con qué rol quedó la persona. */
  const jugadoresEnEquipo = resultado?.orden ?? 0
  const faltanParaMinimo = Math.max(0, MIN_JUGADORES - jugadoresEnEquipo)
  const rolAsignado = jugadoresEnEquipo <= TITULARES ? 'titular' : 'suplente'

  /* La CLABE y el nombre de la cuenta se muestran aparte, con más jerarquía. */
  const datosPago = [
    { etiqueta: 'Titular', valor: 'ALBERTO ISITA' },
    { etiqueta: 'Banco', valor: 'CITIBANAMEX' },
    { etiqueta: 'Concepto', valor: 'Nombre del Equipo' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-950 to-black text-white">
      {/* Fondo decorativo */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="h-full w-full bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:30px_30px]" />
        </div>
        <img
          src="/assets/LOGO COPA.png"
          alt=""
          aria-hidden="true"
          className="
            absolute
            -left-[60%] sm:-left-[40%] md:-left-[30%] lg:-left-[20%] xl:-left-[10%]
            top-[15%] sm:top-[10%]
            w-[110%] sm:w-[90%] md:w-[80%] lg:w-[70%] xl:w-[60%]
            max-w-none opacity-10 blur-[1px]
            animate-float pointer-events-none
          "
        />
      </div>

      <div className="relative z-10">
        {/* Hero */}
        <section className="pt-28 pb-16 md:pt-40 md:pb-24">
          <div className="container mx-auto px-6 max-w-4xl">
            {/* Encuadre tipo póster LQC: marca arriba, ubicación a la derecha */}
            <div className="flex items-center justify-between mb-8 text-xs sm:text-sm font-heading tracking-[0.25em] text-lqc-accent/70">
              <span>LQC 2026</span>
              <span>QRO, MX.</span>
            </div>

            {/* Título protagonista: pesado, mayúsculas, alineado a la izquierda */}
            <h1 className="font-heading font-bold uppercase leading-[0.95] tracking-tight mb-6 [text-shadow:0_0_40px_rgba(0,212,255,0.35)]">
              <span className="block text-4xl sm:text-6xl md:text-7xl text-white">
                Split Otoño
              </span>
              <span className="block text-6xl sm:text-8xl md:text-9xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-blue-300 to-lqc-accent">
                2026
              </span>
            </h1>

            {/* Línea divisoria estilo póster */}
            <div className="h-px w-full bg-gradient-to-r from-lqc-accent/60 via-blue-500/20 to-transparent mb-8" />

            <p className="text-lg md:text-xl text-gray-300 max-w-2xl leading-relaxed">
              Cada jugador se registra por su cuenta. Si tu equipo ya está inscrito,
              elígelo de las sugerencias para no crear uno repetido.
            </p>
          </div>
        </section>

        {/* Formulario */}
        <section className="pb-28">
          <div className="container mx-auto px-6 max-w-4xl">
            {resultado ? (
              /* ---------- Estado de éxito ----------
                 Sin `role="status"`: la live region se inserta junto con su
                 contenido (varios lectores no la anuncian) y, si anuncia, lee la
                 tarjeta entera encima del <h2> recién enfocado. El foco alcanza y
                 es determinista. */
              <div
                ref={tarjetaExitoRef}
                className="scroll-mt-28 bg-black/40 backdrop-blur-md border border-lqc-accent/20 rounded-2xl p-10 md:p-16 text-center shadow-lqc-lg"
              >
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-lqc-800/60 to-lqc-600/40 flex items-center justify-center mx-auto mb-8">
                  <CheckCircle className="w-10 h-10 text-lqc-accent" />
                </div>
                {/* tabIndex -1: destino de foco programático, no tabulable.
                    outline-none es seguro acá porque es un encabezado, no un control. */}
                <h2
                  ref={tituloExitoRef}
                  tabIndex={-1}
                  className="text-2xl md:text-3xl font-light mb-4 focus:outline-none"
                >
                  ¡Listo, ya estás registrado!
                </h2>

                <p className="text-gray-300 mb-8 max-w-lg mx-auto leading-relaxed">
                  Te uniste a{' '}
                  <span className="text-white font-medium">{equipoRegistrado}</span> como{' '}
                  <span className="text-white font-medium">{rolAsignado}</span>.
                </p>

                {/* El contador del equipo. Es la razón de ser de esta pantalla: sin
                    él, nadie sabe que su equipo todavía no puede competir. El número
                    sale del `orden` que devolvió la RPC —la base, no el cliente—, y
                    el mínimo va explícito porque «3 jugadores» a secas no dice si eso
                    alcanza o no. */}
                <div className="mb-8 mx-auto max-w-md rounded-2xl border border-blue-800/30 bg-blue-950/20 p-6">
                  {/* La referencia cambia al llegar al mínimo. Con el piso fijo, un
                      equipo de 6 o 7 —casos normales, no raros— mostraba «6 de 5», que
                      se lee como un error de la página. Pasado el mínimo, el número que
                      informa es el techo: cuántos más caben. */}
                  <p className="font-heading text-2xl md:text-3xl text-white mb-2">
                    {jugadoresEnEquipo} de {faltanParaMinimo > 0 ? MIN_JUGADORES : MAX_JUGADORES}
                  </p>
                  <p className="text-sm text-gray-400 mb-4">
                    {faltanParaMinimo > 0
                      ? `jugadores registrados, de los ${MIN_JUGADORES} mínimos para competir`
                      : `jugadores registrados, de los ${MAX_JUGADORES} que caben en un equipo`}
                  </p>
                  {faltanParaMinimo > 0 ? (
                    <p className="text-gray-300 leading-relaxed">
                      {faltanParaMinimo === 1
                        ? 'Falta 1 compañero por registrarse.'
                        : `Faltan ${faltanParaMinimo} compañeros por registrarse.`}{' '}
                      Cada uno se registra por su cuenta en esta misma página y elige{' '}
                      <span className="text-white font-medium">{equipoRegistrado}</span> de
                      las sugerencias.
                    </p>
                  ) : (
                    <p className="text-gray-300 leading-relaxed">
                      Tu equipo ya llegó al mínimo para competir. Todavía pueden sumarse
                      hasta {MAX_JUGADORES} jugadores en total.
                    </p>
                  )}
                </div>

                <p className="text-gray-300 mb-10 max-w-lg mx-auto leading-relaxed">
                  Te contactaremos para confirmar la inscripción y el pago.
                </p>

                <div className="mb-10">
                  <p className="text-sm text-gray-400 mb-4">Síguenos para novedades:</p>
                  <div className="flex flex-col sm:flex-row gap-3 sm:justify-center">
                    <a
                      href="https://www.facebook.com/lolqrochampionship/"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Facebook (abre en pestaña nueva)"
                      className={CLASE_ENLACE_COMUNIDAD}
                    >
                      <Facebook className="w-5 h-5" />
                      Facebook
                    </a>
                    <a
                      href="https://discord.gg/eS6zkvfkp"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Discord (abre en pestaña nueva)"
                      className={CLASE_ENLACE_COMUNIDAD}
                    >
                      <MessageSquare className="w-5 h-5" />
                      Discord
                    </a>
                  </div>
                </div>

                {/* Reusa la clase compartida en vez de repetirla inline, que es como
                    estaba: la versión inline no traía el `focus-visible:ring`, así que
                    tabulando sobre fondo negro no se veía dónde estaba el foco. */}
                <button
                  type="button"
                  onClick={reiniciar}
                  className={`${CLASE_BOTON_SECUNDARIO} px-8 py-4 text-base`}
                >
                  Registrar a otra persona
                </button>
              </div>
            ) : (
              /* ---------- Formulario ---------- */
              <form onSubmit={handleSubmit} noValidate className="space-y-12">
                {/* Equipo.
                    `relative z-20` en la SECCIÓN, no en la lista: `CLASE_TARJETA` lleva
                    `backdrop-blur-sm`, y un backdrop-filter crea contexto de apilamiento,
                    así que el `z-20` del desplegable solo vale dentro de su tarjeta. Sin
                    esto, la tarjeta de «Tus Datos» —otro contexto, posterior en el DOM—
                    se pinta encima de las sugerencias desplegadas. */}
                <div className="relative z-20">
                  <TituloSeccion>Tu Equipo</TituloSeccion>
                  <div className={CLASE_TARJETA}>
                    <ComboboxEquipo
                      valor={form.equipo}
                      elegido={equipoElegido}
                      error={errores.equipo ?? errorEquipoServidor}
                      creacionBloqueada={rechazo === 'torneo_lleno'}
                      onTexto={setTextoEquipo}
                      onElegir={elegirEquipo}
                      onDeshacer={deshacerEquipo}
                    />

                    {/* Capitán. Va acá y no con los datos personales porque no es un
                        dato de la persona sino de su relación con el equipo, que es
                        justo lo que esta tarjeta trata.
                        Sin `required`, sin validación y sin advertencia si nadie la
                        marca: ver el comentario de `validar()`. */}
                    <div className="mt-8 pt-6 border-t border-white/5">
                      <label className="flex items-start gap-4 cursor-pointer group">
                        <input
                          id="es_capitan"
                          type="checkbox"
                          name="es_capitan"
                          checked={esCapitan}
                          onChange={(e) => setEsCapitan(e.target.checked)}
                          className="peer sr-only"
                        />
                        <span
                          className={`
                            mt-0.5 w-6 h-6 shrink-0 rounded-md border-2 flex items-center justify-center transition-all duration-300
                            peer-focus:ring-2 peer-focus:ring-lqc-accent/60 peer-focus:ring-offset-2 peer-focus:ring-offset-black
                            ${esCapitan
                              ? 'bg-gradient-to-br from-lqc-700 to-lqc-500 border-lqc-500'
                              : 'bg-black/40 border-white/20 group-hover:border-blue-500/60'
                            }
                          `}
                        >
                          {esCapitan && <Check className="w-4 h-4 text-white" />}
                        </span>
                        <span className="text-sm md:text-base text-gray-200 leading-relaxed">
                          <span className="flex items-center gap-2 text-white font-medium mb-1">
                            <Crown className="w-4 h-4 text-lqc-accent" aria-hidden="true" />
                            Soy el capitán del equipo
                          </span>
                          <span className="text-gray-400">
                            El capitán es el contacto con la organización: recibe los
                            avisos y representa al equipo en las decisiones. Si nadie de
                            tu equipo la marca, tomamos al primero que se registró.
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Datos del jugador */}
                <div>
                  <TituloSeccion>Tus Datos</TituloSeccion>
                  <div className={CLASE_TARJETA}>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        <CampoTexto
                          id="gamertag"
                          /* El label es «Riot ID» (lo que valida REGEX_RIOT_ID), pero la
                             clave del estado y la columna se llaman `gamertag`:
                             renombrarlas rompe el contrato con la RPC. */
                          label="Riot ID"
                          icono={Gamepad2}
                          valor={form.gamertag}
                          onChange={setGamertag}
                          /* Prioridad: el rechazo del servidor, después el error del
                             envío local y por último el veredicto remoto. El del
                             servidor va primero porque es el más nuevo — llegó después
                             de que el formulario ya había pasado la validación local. */
                          error={
                            errorGamertagServidor ??
                            errores.gamertag ??
                            (estadoRiot === 'no_encontrado' ? MENSAJE_RIOT_ID_NO_EXISTE : undefined)
                          }
                          placeholder="Jugador#MX1"
                          autoComplete="off"
                          describedById="gamertag-ayuda"
                          onBlur={() => comprobarRiotId(form.gamertag)}
                          /* El 'no_encontrado' no pone ícono: ya se ve como error de
                             campo (borde rojo + mensaje con su propio ícono) y un
                             segundo símbolo sería ruido. */
                          sufijo={
                            estadoRiot === 'validando' ? (
                              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                            ) : estadoRiot === 'valido' ? (
                              <Check className="w-5 h-5 text-green-400" />
                            ) : null
                          }
                        />
                        <p id="gamertag-ayuda" className="mt-2 text-sm text-gray-400">
                          Riot ID completo: nombre, luego #, luego tag (por ejemplo,
                          Jugador#MX1).
                        </p>
                        {/* El resultado llega con el foco ya en otro campo, así que se
                            anuncia por su propia región viva. */}
                        <span role="status" aria-live="polite" className="sr-only">
                          {anuncioRiot}
                        </span>
                      </div>

                      <CampoTexto
                        id="nombre"
                        label="Nombre"
                        icono={User}
                        valor={form.nombre}
                        onChange={(v) => setCampo('nombre', v)}
                        error={errores.nombre}
                        placeholder="Nombre completo"
                        autoComplete="name"
                      />
                      <CampoTexto
                        id="fecha_nacimiento"
                        label="Fecha de Nacimiento"
                        icono={Calendar}
                        tipo="date"
                        valor={form.fecha_nacimiento}
                        onChange={(v) => setCampo('fecha_nacimiento', v)}
                        error={errores.fecha_nacimiento}
                        min={MIN_FECHA_NACIMIENTO}
                        max={MAX_FECHA_NACIMIENTO}
                        claseInput="[color-scheme:dark]"
                      />
                      <CampoTexto
                        id="celular"
                        label="Celular"
                        icono={Phone}
                        tipo="tel"
                        valor={form.celular}
                        onChange={(v) => setCampo('celular', v)}
                        error={errores.celular}
                        placeholder="10 dígitos"
                        autoComplete="tel"
                      />
                      <CampoTexto
                        id="correo"
                        label="Correo electrónico"
                        icono={Mail}
                        tipo="email"
                        valor={form.correo}
                        onChange={(v) => setCampo('correo', v)}
                        error={errores.correo}
                        placeholder="jugador@correo.com"
                        autoComplete="email"
                      />
                      <CampoTexto
                        id="municipio"
                        label="Municipio"
                        icono={MapPin}
                        valor={form.municipio}
                        onChange={(v) => setCampo('municipio', v)}
                        error={errores.municipio}
                        placeholder="Municipio donde vives"
                        autoComplete="address-level2"
                        claseContenedor="md:col-span-2"
                      />
                    </div>

                    {/* Escolaridad. El campo condicional de «Otros» va FUERA del
                        fieldset con `role="radiogroup"`: un `textbox` no es hijo válido
                        de un radiogroup y algunos lectores lo saltan o anuncian mal la
                        posición ("3 de 4"). */}
                    <div className="mt-8">
                      <fieldset
                        role="radiogroup"
                        aria-labelledby="escolaridad-label"
                        aria-required="true"
                        aria-invalid={errores.escolaridad ? true : undefined}
                        aria-describedby={errores.escolaridad ? 'escolaridad-error' : undefined}
                        className="border-0 p-0 m-0"
                      >
                        <legend
                          id="escolaridad-label"
                          className="flex items-center gap-2 text-sm text-gray-400 mb-3"
                        >
                          <GraduationCap className="w-4 h-4 text-blue-400" />
                          Escolaridad <span className="text-lqc-accent" aria-hidden="true">*</span>
                        </legend>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          {OPCIONES_ESCOLARIDAD.map((opcion, i) => (
                            <OpcionPill
                              key={opcion}
                              /* El id va en la PRIMERA opción: es el nodo al que
                                 `enfocarClave('escolaridad')` lleva el foco. */
                              id={i === 0 ? 'escolaridad' : undefined}
                              name="escolaridad"
                              valor={opcion}
                              seleccionado={form.escolaridad === opcion}
                              onSelect={(v) => setOpcion('escolaridad', v)}
                              error={Boolean(errores.escolaridad)}
                            />
                          ))}
                        </div>
                        {errores.escolaridad && (
                          <MensajeError id="escolaridad-error" texto={errores.escolaridad} />
                        )}
                      </fieldset>
                      {form.escolaridad === 'Otros' && (
                        <div className="mt-4">
                          <CampoTexto
                            id="escolaridad_otro"
                            label="Especifica la escolaridad"
                            icono={GraduationCap}
                            valor={form.escolaridad_otro}
                            onChange={(v) => setCampo('escolaridad_otro', v)}
                            error={errores.escolaridad_otro}
                            placeholder="¿Cuál?"
                          />
                        </div>
                      )}
                    </div>

                    {/* Género. Mismo criterio que escolaridad con el campo de «Otros». */}
                    <div className="mt-8">
                      <fieldset
                        role="radiogroup"
                        aria-labelledby="genero-label"
                        aria-required="true"
                        aria-invalid={errores.genero ? true : undefined}
                        aria-describedby={errores.genero ? 'genero-error' : undefined}
                        className="border-0 p-0 m-0"
                      >
                        <legend
                          id="genero-label"
                          className="flex items-center gap-2 text-sm text-gray-400 mb-3"
                        >
                          <UserCircle className="w-4 h-4 text-blue-400" />
                          Género <span className="text-lqc-accent" aria-hidden="true">*</span>
                        </legend>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {OPCIONES_GENERO.map((opcion, i) => (
                            <OpcionPill
                              key={opcion}
                              id={i === 0 ? 'genero' : undefined}
                              name="genero"
                              valor={opcion}
                              seleccionado={form.genero === opcion}
                              onSelect={(v) => setOpcion('genero', v)}
                              error={Boolean(errores.genero)}
                            />
                          ))}
                        </div>
                        {errores.genero && (
                          <MensajeError id="genero-error" texto={errores.genero} />
                        )}
                      </fieldset>
                      {form.genero === 'Otros' && (
                        <div className="mt-4">
                          <CampoTexto
                            id="genero_otro"
                            label="Especifica el género"
                            icono={UserCircle}
                            valor={form.genero_otro}
                            onChange={(v) => setCampo('genero_otro', v)}
                            error={errores.genero_otro}
                            placeholder="¿Cuál?"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Pago de inscripción (informativo) */}
                <div>
                  <TituloSeccion>Pago de Inscripción</TituloSeccion>
                  <div className="bg-gradient-to-br from-blue-950/30 to-lqc-900/20 backdrop-blur-sm border border-blue-800/30 rounded-2xl p-6 md:p-8 shadow-lqc">
                    {/* Encabezado: de qué cuenta se trata + cuánto se transfiere. */}
                    <div className="flex flex-wrap items-center justify-between gap-5 pb-6 mb-6 border-b border-white/5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-black/40 border border-blue-700/40 flex items-center justify-center shrink-0">
                          <CreditCard className="w-6 h-6 text-lqc-accent" />
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
                            Cuenta bancaria
                          </p>
                          <p className="text-lg md:text-xl font-medium text-white">LQC</p>
                        </div>
                      </div>

                      <div className="rounded-xl bg-black/40 border border-blue-700/40 px-5 py-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-1">
                          Inscripción por equipo
                        </p>
                        <p className="font-heading text-2xl md:text-3xl text-white leading-none whitespace-nowrap">
                          $500 <span className="text-base text-gray-400">MXN</span>
                        </p>
                      </div>
                    </div>

                    {/* Con el registro individual esto importa MÁS que antes, no menos:
                        cada quien manda su formulario por separado, así que sin decirlo
                        siete personas podrían pagar $500 cada una. */}
                    <p className="mb-6 text-sm md:text-base text-gray-300 leading-relaxed">
                      La inscripción es de{' '}
                      <span className="text-white font-medium">$500 MXN por equipo</span>,{' '}
                      <span className="text-white font-medium">no por jugador</span>: se hace{' '}
                      <span className="text-white font-medium">un solo pago</span> por equipo y lo
                      realiza el capitán, con el nombre del equipo como concepto.
                    </p>

                    {/* Dato protagonista */}
                    <div className="rounded-xl bg-black/40 border border-lqc-accent/20 p-5 md:p-6">
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-3">
                        CLABE interbancaria
                      </p>
                      <p className="font-mono text-lqc-accent text-lg sm:text-2xl md:text-3xl tracking-wide break-all select-all leading-snug">
                        002680003802575132
                      </p>
                    </div>

                    {/* Datos subordinados */}
                    <dl className="mt-6 grid gap-5 sm:grid-cols-3">
                      {datosPago.map((dato) => (
                        <div key={dato.etiqueta}>
                          <dt className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-1.5">
                            {dato.etiqueta}
                          </dt>
                          <dd className="text-white font-medium break-words">{dato.valor}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>

                {/* Reglamento.
                    Va acá, entre el pago y el aviso de privacidad, y no arriba del
                    formulario: en este punto la persona ya llenó sus datos y está a un
                    paso de enviar, que es cuando de verdad le sirve saber si su equipo
                    es elegible.
                    No es un enlace suelto sino una tarjeta con las dos formas de leerlo,
                    con el mismo lenguaje de la tarjeta de pago (misma familia de
                    gradiente, mismo azulejo de icono). */}
                <div>
                  <TituloSeccion>Reglamento</TituloSeccion>
                  <div className="bg-gradient-to-br from-blue-950/30 to-lqc-900/20 backdrop-blur-sm border border-blue-800/30 rounded-2xl p-6 md:p-8 shadow-lqc">
                    <div className="flex items-start gap-4 mb-6">
                      <div className="w-12 h-12 rounded-xl bg-black/40 border border-blue-700/40 flex items-center justify-center shrink-0">
                        <FileText className="w-6 h-6 text-lqc-accent" aria-hidden="true" />
                      </div>
                      <div>
                        {/* «registrarte» y no «enviar»: es la acción que nombra el botón
                            de abajo, que dice «Registrarme». */}
                        <p className="text-lg md:text-xl font-medium text-white mb-2">
                          Léelo antes de registrarte
                        </p>
                        <p className="text-sm md:text-base text-gray-300 leading-relaxed">
                          El reglamento oficial define{' '}
                          <span className="text-white font-medium">quién puede jugar</span>, el{' '}
                          <span className="text-white font-medium">formato de la competencia</span>{' '}
                          y las{' '}
                          <span className="text-white font-medium">sanciones</span>.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                      {/* Se abre en pestaña nueva por una razón que pesa más que cualquier
                          otra: quien está acá tiene el formulario a medio llenar y sin
                          guardado, así que navegar en la misma pestaña le borra los datos.
                          Un <a> normal y no un <Link> de react-router porque con
                          target="_blank" el navegador hace una carga completa igual: el
                          Link no aportaría navegación del cliente y esta página no importa
                          nada de react-router.
                          Apunta a la PÁGINA y no al PDF a propósito: /reglamento es el
                          destino canónico y en un teléfono —donde no monta el visor— es una
                          tarjeta que ofrece abrir o descargar el archivo, no un error. */}
                      <a
                        href="/reglamento"
                        target="_blank"
                        rel="noopener noreferrer"
                        /* Arranca con el texto visible EXACTO para no romper el control por
                           voz (WCAG 2.5.3, "Label in Name") y recién después avisa lo que
                           el texto no dice. Misma fórmula que los enlaces de comunidad. */
                        aria-label="Ver reglamento (abre en pestaña nueva)"
                        className={`${CLASE_VER_REGLAMENTO} sm:flex-1`}
                      >
                        <ExternalLink className="w-5 h-5 shrink-0" aria-hidden="true" />
                        Ver reglamento
                      </a>

                      {/* Apunta al PDF directo y no a /reglamento: es una descarga, y
                          `download` solo funciona sobre el archivo del mismo origen. */}
                      <a
                        href={RUTA_REGLAMENTO}
                        download={NOMBRE_DESCARGA}
                        aria-label={`Descargar PDF (${PESO_REGLAMENTO}) del reglamento de la LQC 2026`}
                        className={`${CLASE_ENLACE_COMUNIDAD} sm:flex-1`}
                      >
                        <Download className="w-5 h-5 shrink-0" aria-hidden="true" />
                        {/* El peso es texto visible, no solo del aria-label: la decisión de
                            gastar datos móviles la toma quien ve la pantalla. */}
                        Descargar PDF{' '}
                        <span className="text-gray-400">({PESO_REGLAMENTO})</span>
                      </a>
                    </div>

                    {/* HUECO RESERVADO: acá va la casilla «He leído y acepto el
                        reglamento», y está vacío a propósito — no es un olvido.
                        Todavía no se pone porque el PDF publicado tiene puntos que van a
                        cambiar, y marcar una casilla es aceptar UN texto concreto: quien la
                        marcara hoy estaría aceptando algo distinto de lo que va a regir.
                        Y no se puede arreglar después, porque no hay dónde guardar QUÉ
                        versión se aceptó: ni `equipos` ni `jugadores` tienen columna para
                        eso y el payload de la RPC es un tipo cerrado. (Contacto sí hay —el
                        payload manda celular y correo—, así que el problema no es no poder
                        avisar: es que no quedaría registro de qué se aceptó.)
                        Mejor ofrecer el reglamento sin exigir aceptación que exigir una
                        aceptación que no dice de qué.

                        Cuando el PDF quede firme, esto es lo que hay que sumar. OJO: las
                        cuatro cosas son de cliente nomás, igual que `aceptaPrivacidad`, que
                        tampoco se persiste. Si lo que se quiere es una aceptación
                        REGISTRADA con fecha y versión, eso además necesita columna nueva y
                        cambiar la RPC `registrar_jugador`, que vive en Supabase y no en
                        este repo (ver AGENTS.md).
                          1. estado `aceptaReglamento` + su `setState`;
                          2. el `id` del input DEBE ser igual a la clave de error
                             ('reglamento'): `enfocarClave` hace getElementById y si no lo
                             encuentra sale por un `return` sin error, o sea que el foco al
                             primer campo inválido se rompe EN SILENCIO;
                          3. la clave 'reglamento' en `ORDEN_CLAVES`, y va ANTES de
                             'privacidad', no al final: ese arreglo es el orden VISUAL y de
                             ahí sale a qué campo salta el foco;
                          4. la validación dentro de `validar()`, con el mismo patrón que
                             `if (!aceptaPrivacidad)`.
                        Copiar el bloque del checkbox del aviso de privacidad de abajo: ya
                        tiene el input sr-only + `peer`, el foco visible y el MensajeError
                        cableados. (El tipo de errores no hay que tocarlo: `Errores` es
                        `Record<string, string>`, cualquier clave ya es válida.) */}
                  </div>
                </div>

                {/* Aviso de privacidad.
                    VUELVE A LA PRIMERA PERSONA. Con el registro por equipo, quien
                    enviaba era el capitán y los datos eran DE TERCEROS —hasta seis
                    personas que no estaban tocando el formulario—, así que el
                    consentimiento tenía que ser una declaración de que contaba con
                    la autorización de cada integrante. Ahora cada quien manda los
                    suyos: el consentimiento es propio y los derechos ARCO los
                    ejerce la misma persona que está leyendo esto. */}
                <div>
                  <TituloSeccion>Aviso de Privacidad</TituloSeccion>
                  <div className="bg-black/40 backdrop-blur-sm border border-lqc-accent/20 rounded-2xl p-6 md:p-8 shadow-lqc">
                    <div className="flex items-start gap-4 mb-6">
                      <div className="w-12 h-12 rounded-xl bg-black/40 border border-lqc-accent/30 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-6 h-6 text-lqc-accent" />
                      </div>
                      <p className="text-gray-300 leading-relaxed text-sm md:text-base">
                        Tus datos personales se tratan conforme a la{' '}
                        <span className="text-white font-medium">
                          Ley Federal de Protección de Datos Personales en Posesión de los
                          Particulares
                        </span>
                        .
                      </p>
                    </div>

                    <ul className="space-y-4 text-sm md:text-base">
                      <li className="flex items-start gap-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-lqc-accent mt-2.5 shrink-0" />
                        <span className="text-gray-300">
                          <span className="text-white font-medium">Finalidad:</span> organización,
                          logística y comunicación del evento LQC Split Otoño 2026.
                        </span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-lqc-accent mt-2.5 shrink-0" />
                        <span className="text-gray-300">
                          {/* La relación con Revolution505 va explícita porque el correo ARCO
                              es @revolution505.com: si no, el titular no sabe si le escribe
                              al responsable o a un tercero. */}
                          <span className="text-white font-medium">Responsable:</span> League
                          Querétaro Championship (LQC), liga organizada por Revolution505.
                        </span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-lqc-accent mt-2.5 shrink-0" />
                        <span className="text-gray-300">
                          Tus datos{' '}
                          <span className="text-white font-medium">
                            no se comparten con terceros
                          </span>{' '}
                          sin tu consentimiento.
                        </span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-lqc-accent mt-2.5 shrink-0" />
                        <span className="text-gray-300">
                          Puedes ejercer tus{' '}
                          <span className="text-white font-medium">
                            derechos ARCO (acceso, rectificación, cancelación u oposición)
                          </span>{' '}
                          sobre tus propios datos escribiendo a{' '}
                          <a
                            href="mailto:contactolqc@revolution505.com"
                            className="after:hidden text-lqc-accent font-medium underline underline-offset-4 decoration-lqc-accent/40 hover:decoration-lqc-accent"
                          >
                            contactolqc@revolution505.com
                          </a>
                          .
                        </span>
                      </li>
                    </ul>

                    <div className="mt-8 pt-6 border-t border-white/5">
                      <label className="flex items-start gap-4 cursor-pointer group">
                        <input
                          id="privacidad"
                          type="checkbox"
                          name="privacidad"
                          required
                          checked={aceptaPrivacidad}
                          onChange={(e) => {
                            setAceptaPrivacidad(e.target.checked)
                            if (e.target.checked) limpiarError('privacidad')
                          }}
                          aria-invalid={errores.privacidad ? true : undefined}
                          aria-describedby={errores.privacidad ? 'privacidad-error' : undefined}
                          className="peer sr-only"
                        />
                        <span
                          className={`
                            mt-0.5 w-6 h-6 shrink-0 rounded-md border-2 flex items-center justify-center transition-all duration-300
                            peer-focus:ring-2 peer-focus:ring-lqc-accent/60 peer-focus:ring-offset-2 peer-focus:ring-offset-black
                            ${aceptaPrivacidad
                              ? 'bg-gradient-to-br from-lqc-700 to-lqc-500 border-lqc-500'
                              : errores.privacidad
                                ? 'bg-black/40 border-rose-500/70'
                                : 'bg-black/40 border-white/20 group-hover:border-blue-500/60'
                            }
                          `}
                        >
                          {aceptaPrivacidad && <Check className="w-4 h-4 text-white" />}
                        </span>
                        <span className="text-sm md:text-base text-gray-200 leading-relaxed">
                          Acepto que mis datos se traten conforme al aviso de privacidad.{' '}
                          <span className="text-lqc-accent" aria-hidden="true">*</span>
                        </span>
                      </label>
                      {errores.privacidad && (
                        <MensajeError id="privacidad-error" texto={errores.privacidad} />
                      )}
                    </div>
                  </div>
                </div>

                {/* Resumen de errores + envío */}
                <div className="space-y-6">
                  {hayErrores && (
                    <div
                      role="alert"
                      className="flex items-start gap-3 bg-rose-950/30 border border-rose-500/40 rounded-xl p-5"
                    >
                      <AlertCircle className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
                      <p className="text-sm md:text-base text-rose-200">
                        No pudimos enviar tu registro: falta información o hay datos que
                        revisar. Los campos con problemas tienen un mensaje debajo.
                      </p>
                    </div>
                  )}

                  {/* Rechazo de la RPC: la llamada salió bien y la base dijo que no.
                      Mensaje específico por código, nunca el error crudo. */}
                  {rechazo && (
                    <div
                      role="alert"
                      className="flex items-start gap-3 bg-rose-950/30 border border-rose-500/40 rounded-xl p-5"
                    >
                      <AlertCircle className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
                      <p className="text-sm md:text-base text-rose-200">
                        {MENSAJE_RECHAZO[rechazo]}
                        {/* El correo va como enlace y no dentro de la cadena: en un
                            teléfono, un correo en texto plano hay que transcribirlo
                            a mano. */}
                        {rechazo === 'gamertag_duplicado' && (
                          <>
                            {' '}
                            Si crees que es un error, escríbenos a{' '}
                            <a
                              href="mailto:contactolqc@revolution505.com"
                              className="after:hidden text-lqc-accent font-medium underline underline-offset-4 decoration-lqc-accent/40 hover:decoration-lqc-accent"
                            >
                              contactolqc@revolution505.com
                            </a>{' '}
                            y lo verificamos.
                          </>
                        )}
                        {/* En 'torneo_lleno' el correo es la ÚNICA salida para quien
                            no encuentra a su equipo en las sugerencias: no puede crear
                            uno y no hay nada más que pueda hacer desde acá. */}
                        {rechazo === 'torneo_lleno' && (
                          <>
                            {' '}
                            Si no encuentras a tu equipo en la lista, escríbenos a{' '}
                            <a
                              href="mailto:contactolqc@revolution505.com"
                              className="after:hidden text-lqc-accent font-medium underline underline-offset-4 decoration-lqc-accent/40 hover:decoration-lqc-accent"
                            >
                              contactolqc@revolution505.com
                            </a>{' '}
                            antes de darlo por perdido.
                          </>
                        )}
                      </p>
                    </div>
                  )}

                  {errorEnvio && (
                    <div
                      role="alert"
                      className="flex items-start gap-3 bg-rose-950/30 border border-rose-500/40 rounded-xl p-5"
                    >
                      <AlertCircle className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
                      <p className="text-sm md:text-base text-rose-200">
                        No pudimos enviar tu registro. Revisa tu conexión e inténtalo de
                        nuevo en unos minutos. Los datos siguen escritos en el formulario.
                      </p>
                    </div>
                  )}

                  {/* `disabled` + clases de estado en vez de un `bg-*`: la regla base
                      de index.css le pone un gradiente a todo <button> y las utilidades
                      de Tailwind solo pisan `background-color`, no `background-image`. */}
                  <button
                    type="submit"
                    disabled={enviando}
                    aria-busy={enviando}
                    className={`w-full py-4 bg-gradient-to-r from-lqc-700 to-lqc-500 rounded-xl font-medium transition-all duration-300 shadow-lg shadow-blue-900/30 flex items-center justify-center gap-3 ${
                      enviando
                        ? 'opacity-60 cursor-not-allowed'
                        : 'hover:from-lqc-600 hover:to-lqc-400'
                    }`}
                  >
                    {enviando ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Enviando…
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Registrarme
                      </>
                    )}
                  </button>

                  <p className="text-center text-sm text-gray-400">
                    Los campos marcados con{' '}
                    <span className="text-lqc-accent">*</span> son obligatorios.
                  </p>
                </div>
              </form>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
