import { useEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Users, Gamepad2, User, Calendar, Phone, GraduationCap,
  MapPin, Mail, UserCircle, ShieldCheck, CreditCard,
  Send, CheckCircle, AlertCircle, Check, Facebook, MessageSquare,
  Loader2, UserPlus, Trash2, FileText, ExternalLink, Download
} from 'lucide-react'
import { obtenerSupabase } from '../lib/supabase'
import { RUTA_REGLAMENTO, NOMBRE_DESCARGA, PESO_REGLAMENTO } from '../lib/reglamento'
import { validarRiotId } from '../lib/atak'
import type { ResultadoRiotId } from '../lib/atak'

/* ------------------------------------------------------------------ */
/*  Modelo del formulario                                              */
/* ------------------------------------------------------------------ */

/* MODELO NUEVO: el CAPITÁN registra al equipo entero de una sola vez. Antes cada
   jugador se registraba solo y una fila de `inscripciones` era un jugador; ahora
   todo el envío pasa por la RPC `registrar_equipo`, que escribe en `equipos` y
   `jugadores`. La tabla `inscripciones` sigue existiendo pero ya no la toca esta
   página. (`/admin` todavía lee de la vieja: se arregla en otro commit.)

   Consecuencia directa para el código de acá abajo: TODO lo que era un dato
   suelto pasa a estar indexado por jugador. Los ids del DOM, las claves de error
   y la validación del Riot ID no podían seguir siendo globales — con 7 jugadores
   habría 7 elementos peleando por `id="nombre"`. */

/* Campos que se repiten por jugador. `escolaridad_otro` y `genero_otro` viven en
   el estado pero NO viajan: se resuelven antes de armar el payload. */
type CampoJugador =
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

/* Orden VISUAL de los campos dentro de una tarjeta. Se usa para llevar el foco al
   primer campo inválido: las claves de un objeto no garantizan este orden. */
const CAMPOS_JUGADOR: CampoJugador[] = [
  'gamertag',
  'nombre',
  'fecha_nacimiento',
  'celular',
  'correo',
  'municipio',
  'escolaridad',
  'escolaridad_otro',
  'genero',
  'genero_otro'
]

/* `uid` es la identidad ESTABLE de la tarjeta y no se manda a la base. Existe
   porque el orden del array sí cambia: quitar al jugador 2 corre a todos los de
   abajo, y si las claves de error, los ids del DOM y el estado de validación del
   Riot ID colgaran del índice, cada eliminación se los mezclaría entre tarjetas
   —el error del jugador 3 aparecería sobre los datos del 4—. El índice se usa
   solo para lo que de verdad es posicional: el número que se ve y el rol que
   asigna la RPC. */
type JugadorForm = { uid: string } & Record<CampoJugador, string>

type EquipoForm = {
  equipo: string
  capitan_nombre: string
  capitan_celular: string
}

/* Contador de módulo, no un ref: los 5 jugadores iniciales se crean en el
   inicializador de useState, antes de que exista ningún ref. Solo necesita ser
   único dentro de la pestaña. */
let contadorUid = 0
function nuevoUid(): string {
  contadorUid += 1
  return `j${contadorUid}`
}

/* El capitán también tiene Riot ID, y esa comprobación necesita exactamente lo mismo
   que la de un jugador: su propio contador de peticiones para descartar respuestas
   viejas, su propio veredicto atado al valor actual y su propio anuncio. Como no es
   una tarjeta, no tiene uid — así que entra a los mismos diccionarios con esta clave
   RESERVADA, en vez de duplicar toda la lógica de carreras en un juego de estados
   aparte. No puede colisionar con un jugador: `nuevoUid()` siempre devuelve `j` + un
   número. Lo único que no comparte es la clave de ERROR, que sigue siendo
   `capitan_nombre` (la del campo), porque ese diccionario es otro. */
const CLAVE_CAPITAN = 'capitan'

function jugadorVacio(): JugadorForm {
  return {
    uid: nuevoUid(),
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
}

const EQUIPO_VACIO: EquipoForm = {
  equipo: '',
  capitan_nombre: '',
  capitan_celular: ''
}

/* Los tres números que definen el roster. TITULARES parte el array en dos: la RPC
   asigna titular a los 5 primeros y suplente del 6º en adelante POR EL ORDEN DEL
   ARRAY, así que acá solo se refleja esa regla, no se decide. `rol` no se manda. */
const MIN_JUGADORES = 5
const MAX_JUGADORES = 7
const TITULARES = 5

/* Id del texto que explica los límites del roster. Vive en la barra de control,
   pero lo referencian los botones «Quitar» de las tarjetas cuando están
   deshabilitados: si no, con 5 jugadores hay 5 controles muertos sin ninguna
   explicación para quien no ve el contador. Hay una sola barra por página, así que
   un id fijo alcanza. */
const ID_LIMITES_ROSTER = 'roster-limites'

/* ------------------------------------------------------------------ */
/*  Errores                                                            */
/* ------------------------------------------------------------------ */

/* Claves planas de dos formas: las del equipo son el nombre del campo a secas
   ('equipo', 'capitan_celular', 'privacidad') y las de jugador van con el uid
   delante ('j3.correo'). Un solo diccionario en vez de uno por jugador para que
   el recuento de errores y el foco al primero sean un recorrido y no un árbol. */
type Errores = Record<string, string>

function claveJugador(uid: string, campo: CampoJugador): string {
  return `${uid}.${campo}`
}

/* La clave de error y el id del DOM son la misma cosa con distinto separador: el
   punto no es válido en un selector sin escapar y `getElementById` no lo necesita,
   pero mantenerlos alineados evita tener dos convenciones que se puedan desfasar. */
function idDeClave(clave: string): string {
  return clave.replace('.', '-')
}

/* ------------------------------------------------------------------ */
/*  Contrato con la RPC                                                */
/* ------------------------------------------------------------------ */

/* Forma EXACTA que espera `registrar_equipo`. Anotar el objeto literal con este
   tipo activa el chequeo de propiedades en exceso de TypeScript: una clave de más
   o un typo son error de compilación y no un fallo en runtime con el banner
   genérico. Mismo motivo que tenía el payload del modelo viejo — el cliente está
   tipado como `SupabaseClient` sin un `Database` generado, así que `.rpc()` acepta
   literalmente cualquier cosa.

   `rol` NO va: lo asigna la función por la posición en `jugadores`.

   DEUDA: lo correcto a futuro es generar los tipos del esquema con
   `supabase gen types typescript` y pasarlos como `SupabaseClient<Database>`. */
type PayloadJugador = {
  gamertag: string
  nombre: string
  fecha_nacimiento: string
  celular: string
  correo: string
  municipio: string
  escolaridad: string
  genero: string
}

type PayloadRegistro = {
  equipo: string
  capitan_nombre: string
  capitan_celular: string
  jugadores: PayloadJugador[]
}

/* Códigos de rechazo que devuelve la RPC en `{ ok:false, error }`. Son rechazos de
   NEGOCIO, no fallos técnicos: la llamada salió bien y la función dijo que no. Por
   eso viajan por un estado propio y no por el mismo banner que un error de red. */
type CodigoRechazo =
  | 'min_jugadores'
  | 'max_jugadores'
  | 'falta_equipo'
  | 'equipo_duplicado'

const CODIGOS_RECHAZO: CodigoRechazo[] = [
  'min_jugadores',
  'max_jugadores',
  'falta_equipo',
  'equipo_duplicado'
]

/* Mensajes accionables: cada uno dice QUÉ pasó y QUÉ hacer. `equipo_duplicado` es
   el que más contexto necesita —la persona no puede ver la lista de equipos ya
   registrados (el cliente anónimo no lee las tablas), así que sin explicar cómo se
   compara el nombre parecería un error del sitio—. */
const MENSAJE_RECHAZO: Record<CodigoRechazo, string> = {
  min_jugadores: `El equipo necesita al menos ${MIN_JUGADORES} jugadores para competir. Agrega los que falten y vuelve a enviar.`,
  max_jugadores: `El equipo no puede tener más de ${MAX_JUGADORES} jugadores. Quita los que sobren y vuelve a enviar.`,
  falta_equipo: 'Falta el nombre del equipo. Escríbelo arriba y vuelve a enviar.',
  equipo_duplicado:
    'Ya hay un equipo registrado con ese nombre. La comparación no distingue mayúsculas, minúsculas ni espacios de más, así que «Los Panditas» y «los panditas» cuentan como el mismo.'
}

/* Versión corta para el error del CAMPO. Los dos rechazos que apuntan al nombre
   del equipo se pintan en dos lugares —el banner y el propio input, que además
   recibe el foco—, así que con un solo texto largo un lector de pantalla lo lee
   entero dos veces: una por el `role="alert"` y otra por el `aria-describedby`
   del campo enfocado. La explicación completa vive solo en el banner. */
const MENSAJE_RECHAZO_CAMPO: Partial<Record<CodigoRechazo, string>> = {
  equipo_duplicado: 'Ese nombre ya está registrado. Lee el detalle en el aviso de abajo.',
  falta_equipo: 'Escribe el nombre del equipo.'
}

/* Lectura defensiva de lo que devuelve la RPC, con el mismo criterio que
   `leerVeredicto` en src/lib/atak.ts: llega como `unknown` y solo las formas
   exactas producen un resultado. Cualquier otra cosa —clave ausente, tipo
   distinto, un código que no conocemos— cae en 'desconocido' y se trata como
   fallo genérico, que es lo único honesto que se puede decir de una respuesta
   que no se entiende. */
function leerRespuesta(cuerpo: unknown): 'ok' | CodigoRechazo | 'desconocido' {
  if (typeof cuerpo !== 'object' || cuerpo === null) return 'desconocido'

  const { ok, error } = cuerpo as { ok?: unknown; error?: unknown }
  if (ok === true) return 'ok'
  if (ok !== false) return 'desconocido'

  return CODIGOS_RECHAZO.find((codigo) => codigo === error) ?? 'desconocido'
}

/* ------------------------------------------------------------------ */
/*  Validación (helpers puros reusados del modelo anterior)            */
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

/* `id` pasó de `keyof FormState` a `string`: los campos de jugador se llaman
   `j3-correo` y ya no hay un tipo cerrado que los enumere. La restricción vieja
   servía cuando había un solo juego de campos; ahora quien construye el id es
   `idDeClave`, que es el que garantiza que sea único. */
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
   CTA primario, y eso es deliberado: el CTA primario de esta página es «Registrar
   equipo», el botón de envío a ancho completo que está dos secciones más abajo. Un
   segundo botón relleno con el mismo gradiente lo empata y deja de haber un solo camino
   obvio — la trampa que AGENTS.md documenta al revés (secundarios que se ven más
   vívidos que el primario).
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

/* Botones del roster (agregar / quitar). `bg-none` desactiva el gradiente que la
   regla base de index.css le pone a TODO <button>: sin él, "Quitar" se vería más
   vívido que el CTA de envío. `hover:[transform:none]` y `hover:shadow-none`
   matan el salto de -2px y el glow, que dentro de una tarjeta de datos se leen
   como jank. Mismo tratamiento que los botones del panel de admin. */
const CLASE_BOTON_ROSTER_BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-sans font-medium tracking-normal ' +
  'bg-none transition-colors duration-200 hover:[transform:none] hover:shadow-none ' +
  'disabled:opacity-50 disabled:cursor-not-allowed ' +
  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lqc-accent/60 ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-black'
const CLASE_BOTON_AGREGAR =
  `${CLASE_BOTON_ROSTER_BASE} bg-black/50 border border-blue-800/40 text-gray-200 hover:bg-blue-950/40 hover:border-blue-600/60 hover:text-white`
/* Familia `rose`, la misma que el proyecto usa para lo que retira o falla, pero
   fantasma (sin relleno) para que no compita con el envío. */
const CLASE_BOTON_QUITAR =
  `${CLASE_BOTON_ROSTER_BASE} bg-black/40 border border-rose-500/30 text-rose-200 hover:bg-rose-950/30 hover:border-rose-400/60 hover:text-white`

/* ------------------------------------------------------------------ */
/*  Tarjeta de jugador                                                 */
/* ------------------------------------------------------------------ */

/* <fieldset> + <legend> y no un <div> con <h3>: es un grupo de controles de
   formulario, que es exactamente lo que fieldset marca. Un lector de pantalla
   antepone la leyenda al nombre de cada campo de adentro, así que "Nombre" se
   anuncia como "Jugador 3 · Suplente, Nombre" y deja de haber siete campos
   "Nombre" indistinguibles. Los radiogroups de escolaridad y género van
   anidados: fieldsets dentro de fieldsets es HTML válido.

   `scroll-mt-28` para que el header sticky no tape la tarjeta cuando el foco
   salta acá tras un envío con errores. */
function TarjetaJugador({
  jugador,
  indice,
  total,
  errores,
  estadoRiotId,
  anuncioRiotId,
  onCampo,
  onOpcion,
  onGamertag,
  onComprobarRiotId,
  onQuitar
}: {
  jugador: JugadorForm
  indice: number
  total: number
  errores: Errores
  estadoRiotId: EstadoRiotId
  anuncioRiotId: string
  onCampo: (uid: string, campo: CampoJugador, valor: string) => void
  onOpcion: (uid: string, campo: 'escolaridad' | 'genero', valor: string) => void
  onGamertag: (uid: string, valor: string) => void
  /* Recibe el valor además de la clave: así quien comprueba no tiene que salir a
     buscar la tarjeta en el array, y la misma función sirve para el capitán. */
  onComprobarRiotId: (uid: string, valor: string) => void
  onQuitar: (uid: string) => void
}) {
  const { uid } = jugador
  const esTitular = indice < TITULARES
  const numero = indice + 1
  const idAyudaRiot = `${uid}-gamertag-ayuda`

  /* El error de un campo del jugador: se lee del diccionario plano con la clave
     compuesta, no de un objeto por tarjeta. */
  const err = (campo: CampoJugador) => errores[claveJugador(uid, campo)]
  const id = (campo: CampoJugador) => idDeClave(claveJugador(uid, campo))

  return (
    /* Sin `border` (que trae CLASE_TARJETA) porque el <fieldset> ya tiene borde
       propio del navegador y las dos utilidades se pisarían por su orden en el CSS
       generado, no por el orden en que se escriben. El contorno lo da un `ring`,
       que no compite con nada. */
    <fieldset
      /* `min-w-0`: el UA le da a <fieldset> `min-inline-size: min-content` y el
         preflight de Tailwind NO lo resetea, así que con un input de fecha adentro
         la tarjeta no podría encogerse por debajo de su contenido y a 320px
         desbordaría a lo ancho. */
      className={`scroll-mt-28 m-0 min-w-0 border-0 rounded-2xl bg-black/30 p-6 md:p-8 backdrop-blur-sm ring-1 ${
        esTitular ? 'ring-lqc-accent/20' : 'ring-white/5'
      }`}
    >
      {/* La leyenda es el nombre que un lector de pantalla antepone a CADA campo
          del grupo ("Jugador 3, suplente. Nombre"), así que lleva solo eso. El
          botón «Quitar» va fuera: dentro de <legend> su texto se colaría en el
          nombre de los diez campos de la tarjeta. Va `sr-only` porque el mismo
          rótulo se pinta abajo con jerarquía visual. */}
      <legend className="sr-only">
        Jugador {numero}, {esTitular ? 'titular' : 'suplente'}
      </legend>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-heading text-lg md:text-xl text-white">
            Jugador {numero}
          </span>
          {/* El rol es información, no un control: no se elige acá, lo asigna la
              posición. Por eso es una pastilla y no un botón. */}
          <span
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              esTitular
                ? 'border-lqc-accent/40 bg-lqc-900/40 text-lqc-accent'
                : 'border-white/15 bg-black/40 text-gray-300'
            }`}
          >
            {esTitular ? 'Titular' : 'Suplente'}
          </span>
        </div>

        {/* Quitar solo existe por encima del mínimo. Deshabilitado y no oculto:
            que el control desaparezca cambiaría el layout de las 5 tarjetas
            restantes justo cuando alguien acaba de usarlo. */}
        <button
          type="button"
          onClick={() => onQuitar(uid)}
          disabled={total <= MIN_JUGADORES}
          aria-label={`Quitar al jugador ${numero}`}
          aria-describedby={total <= MIN_JUGADORES ? ID_LIMITES_ROSTER : undefined}
          className={CLASE_BOTON_QUITAR}
        >
          <Trash2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          Quitar
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <CampoTexto
            id={id('gamertag')}
            /* El label es «Riot ID» (lo que valida REGEX_RIOT_ID), pero la clave
               del estado y la columna se llaman `gamertag`: renombrarlas rompe
               el contrato con la RPC. */
            label="Riot ID"
            icono={Gamepad2}
            valor={jugador.gamertag}
            onChange={(v) => onGamertag(uid, v)}
            /* El error del envío tiene prioridad; si no hay, se deriva del
               veredicto remoto. Derivado y no guardado en `errores` a propósito:
               ese objeto enciende el banner de "No pudimos enviar el registro",
               que no corresponde cuando nadie envió nada todavía. */
            error={
              err('gamertag') ??
              (estadoRiotId === 'no_encontrado' ? MENSAJE_RIOT_ID_NO_EXISTE : undefined)
            }
            placeholder="Jugador#MX1"
            autoComplete="off"
            describedById={idAyudaRiot}
            onBlur={() => onComprobarRiotId(uid, jugador.gamertag)}
            /* El 'no_encontrado' no pone ícono: ya se ve como error de campo
               (borde rojo + mensaje con su propio ícono) y un segundo símbolo
               sería ruido. */
            sufijo={
              estadoRiotId === 'validando' ? (
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              ) : estadoRiotId === 'valido' ? (
                <Check className="w-5 h-5 text-green-400" />
              ) : null
            }
          />
          <p id={idAyudaRiot} className="mt-2 text-sm text-gray-400">
            Riot ID completo: nombre, luego #, luego tag (por ejemplo, Jugador#MX1).
          </p>
          {/* Región viva propia de ESTA tarjeta. Una sola región compartida entre
              los 7 jugadores anunciaría "Riot ID verificado" sin decir de quién, y
              dos comprobaciones que terminan juntas se pisarían. */}
          <span role="status" aria-live="polite" className="sr-only">
            {anuncioRiotId}
          </span>
        </div>

        <CampoTexto
          id={id('nombre')}
          label="Nombre"
          icono={User}
          valor={jugador.nombre}
          onChange={(v) => onCampo(uid, 'nombre', v)}
          error={err('nombre')}
          placeholder="Nombre completo"
          autoComplete="off"
        />
        <CampoTexto
          id={id('fecha_nacimiento')}
          label="Fecha de Nacimiento"
          icono={Calendar}
          tipo="date"
          valor={jugador.fecha_nacimiento}
          onChange={(v) => onCampo(uid, 'fecha_nacimiento', v)}
          error={err('fecha_nacimiento')}
          min={MIN_FECHA_NACIMIENTO}
          max={MAX_FECHA_NACIMIENTO}
          claseInput="[color-scheme:dark]"
        />
        <CampoTexto
          id={id('celular')}
          label="Celular"
          icono={Phone}
          tipo="tel"
          valor={jugador.celular}
          onChange={(v) => onCampo(uid, 'celular', v)}
          error={err('celular')}
          placeholder="10 dígitos"
          autoComplete="off"
        />
        <CampoTexto
          id={id('correo')}
          label="Correo electrónico"
          icono={Mail}
          tipo="email"
          valor={jugador.correo}
          onChange={(v) => onCampo(uid, 'correo', v)}
          error={err('correo')}
          placeholder="jugador@correo.com"
          autoComplete="off"
        />
        <CampoTexto
          id={id('municipio')}
          label="Municipio"
          icono={MapPin}
          valor={jugador.municipio}
          onChange={(v) => onCampo(uid, 'municipio', v)}
          error={err('municipio')}
          placeholder="Municipio donde vive"
          autoComplete="off"
          claseContenedor="md:col-span-2"
        />
      </div>

      {/* Escolaridad. El campo condicional de «Otros» va FUERA del fieldset con
          `role="radiogroup"`: un `textbox` no es hijo válido de un radiogroup y
          algunos lectores lo saltan o anuncian mal la posición ("3 de 4"). Con 7
          tarjetas × 2 grupos serían hasta 14 grupos malformados. */}
      <div className="mt-8">
      <fieldset
        role="radiogroup"
        aria-labelledby={`${uid}-escolaridad-label`}
        aria-required="true"
        aria-invalid={err('escolaridad') ? true : undefined}
        aria-describedby={err('escolaridad') ? `${id('escolaridad')}-error` : undefined}
        className="border-0 p-0 m-0"
      >
        <legend
          id={`${uid}-escolaridad-label`}
          className="flex items-center gap-2 text-sm text-gray-400 mb-3"
        >
          <GraduationCap className="w-4 h-4 text-blue-400" />
          Escolaridad <span className="text-lqc-accent" aria-hidden="true">*</span>
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {OPCIONES_ESCOLARIDAD.map((opcion, i) => (
            <OpcionPill
              key={opcion}
              id={i === 0 ? id('escolaridad') : undefined}
              /* `name` por jugador: con un name compartido los 7 grupos de radios
                 serían UN grupo y elegir "Prepa" en el jugador 2 desmarcaría al 1. */
              name={`${uid}-escolaridad`}
              valor={opcion}
              seleccionado={jugador.escolaridad === opcion}
              onSelect={(v) => onOpcion(uid, 'escolaridad', v)}
              error={Boolean(err('escolaridad'))}
            />
          ))}
        </div>
        {err('escolaridad') && (
          <MensajeError id={`${id('escolaridad')}-error`} texto={err('escolaridad') as string} />
        )}
      </fieldset>
      {jugador.escolaridad === 'Otros' && (
        <div className="mt-4">
          <CampoTexto
            id={id('escolaridad_otro')}
            label="Especifica la escolaridad"
            icono={GraduationCap}
            valor={jugador.escolaridad_otro}
            onChange={(v) => onCampo(uid, 'escolaridad_otro', v)}
            error={err('escolaridad_otro')}
            placeholder="¿Cuál?"
          />
        </div>
      )}
      </div>

      {/* Género. Mismo criterio que escolaridad con el campo de «Otros». */}
      <div className="mt-8">
      <fieldset
        role="radiogroup"
        aria-labelledby={`${uid}-genero-label`}
        aria-required="true"
        aria-invalid={err('genero') ? true : undefined}
        aria-describedby={err('genero') ? `${id('genero')}-error` : undefined}
        className="border-0 p-0 m-0"
      >
        <legend
          id={`${uid}-genero-label`}
          className="flex items-center gap-2 text-sm text-gray-400 mb-3"
        >
          <UserCircle className="w-4 h-4 text-blue-400" />
          Género <span className="text-lqc-accent" aria-hidden="true">*</span>
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {OPCIONES_GENERO.map((opcion, i) => (
            <OpcionPill
              key={opcion}
              id={i === 0 ? id('genero') : undefined}
              name={`${uid}-genero`}
              valor={opcion}
              seleccionado={jugador.genero === opcion}
              onSelect={(v) => onOpcion(uid, 'genero', v)}
              error={Boolean(err('genero'))}
            />
          ))}
        </div>
        {err('genero') && (
          <MensajeError id={`${id('genero')}-error`} texto={err('genero') as string} />
        )}
      </fieldset>
      {jugador.genero === 'Otros' && (
        <div className="mt-4">
          <CampoTexto
            id={id('genero_otro')}
            label="Especifica el género"
            icono={UserCircle}
            valor={jugador.genero_otro}
            onChange={(v) => onCampo(uid, 'genero_otro', v)}
            error={err('genero_otro')}
            placeholder="¿Cuál?"
          />
        </div>
      )}
      </div>
    </fieldset>
  )
}

/* ------------------------------------------------------------------ */
/*  Página                                                             */
/* ------------------------------------------------------------------ */

export default function Registro() {
  const [equipoForm, setEquipoForm] = useState<EquipoForm>(EQUIPO_VACIO)
  const [jugadores, setJugadores] = useState<JugadorForm[]>(() =>
    Array.from({ length: MIN_JUGADORES }, jugadorVacio)
  )
  const [errores, setErrores] = useState<Errores>({})
  const [aceptaPrivacidad, setAceptaPrivacidad] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  /* Bandera, no el error real: el mensaje que se muestra es literal en el JSX,
     así que ningún detalle técnico del backend puede filtrarse a la pantalla. */
  const [errorEnvio, setErrorEnvio] = useState(false)
  /* Rechazo de negocio de la RPC. Separado de `errorEnvio` (fallo técnico) y de
     `errores` (validación local) porque los tres significan cosas distintas y
     mezclarlos haría aparecer el banner equivocado: un 'equipo_duplicado' no es
     "falta información en el formulario". */
  const [rechazo, setRechazo] = useState<CodigoRechazo | null>(null)
  /* Anuncio de alta/baja de tarjetas. Es un cambio de estructura de la página que
     no mueve el foco, así que sin esto quien no ve la pantalla no se entera. */
  const [anuncioRoster, setAnuncioRoster] = useState('')

  const tituloExitoRef = useRef<HTMLHeadingElement>(null)
  const tarjetaExitoRef = useRef<HTMLDivElement>(null)
  const enviadoPrevio = useRef(enviado)
  const botonAgregarRef = useRef<HTMLButtonElement>(null)
  const barraRosterRef = useRef<HTMLDivElement>(null)

  /* --- Comprobación del Riot ID contra ATAK.GG (ver src/lib/atak.ts) --- */

  /* N validaciones independientes, una por tarjeta, indexadas por uid. Antes era
     un solo estado porque había un solo Riot ID; con un roster, dos comprobaciones
     pueden estar en vuelo a la vez y cada una tiene que poder terminar sin pisar
     a la otra. */
  const [validaciones, setValidaciones] = useState<Record<string, ValidacionRiotId>>({})
  const [anunciosRiotId, setAnunciosRiotId] = useState<Record<string, string>>({})

  /* Contador de peticiones POR JUGADOR: una respuesta cuyo id ya no es el último
     de SU tarjeta llegó tarde y se descarta. Un contador global haría que teclear
     en el jugador 4 invalidara la comprobación en vuelo del jugador 2. */
  const peticionesRiotId = useRef<Map<string, number>>(new Map())

  /* Caché de veredictos firmes, compartido entre tarjetas y keyeado por el VALOR
     del Riot ID, no por el jugador: dos tarjetas que escriban el mismo texto
     preguntan una sola vez, y el veredicto sigue siendo correcto porque depende
     del valor y de nada más.
     Los 'indeterminado' NO se guardan a propósito: si ATAK o Riot estaban caídos,
     el siguiente blur es una oportunidad legítima de reintentar. */
  const riotIdComprobado = useRef<Map<string, ResultadoRiotId>>(new Map())

  /* Campo al que hay que llevar el foco después del próximo render. Lo usan alta y
     baja de tarjetas: el nodo destino todavía no existe cuando corre el handler. */
  const focoPendiente = useRef<string | null>(null)
  /* Lo mismo para el botón de agregar, que SÍ está montado pero puede estar
     deshabilitado en el momento del handler. Enfocarlo ahí sería un no-op —ver el
     comentario de `quitarJugador`—, así que también se difiere. */
  const focoBotonAgregar = useRef(false)

  /* Estado efectivo de una tarjeta: el veredicto guardado solo vale si sigue siendo
     sobre el Riot ID que hay escrito AHORA en esa tarjeta. Cualquier otra cosa se
     lee como 'inactivo', que es el estado que no dice ni bloquea nada. */
  const estadoRiotIdDe = (clave: string, valorActual: string): EstadoRiotId => {
    const validacion = validaciones[clave]
    if (!validacion) return 'inactivo'
    return validacion.valor === valorActual.trim() ? validacion.estado : 'inactivo'
  }

  /* Orden VISUAL de todas las claves de error, recalculado en cada render porque
     depende de cuántas tarjetas hay. Reemplaza al ORDEN_CAMPOS fijo del modelo
     viejo, que no podía existir con un roster de tamaño variable. */
  const ordenClaves = (): string[] => [
    'equipo',
    'capitan_nombre',
    'capitan_celular',
    ...jugadores.flatMap((j) => CAMPOS_JUGADOR.map((campo) => claveJugador(j.uid, campo))),
    'privacidad'
  ]

  /* Foco + scroll a un campo por su clave de error. `preventScroll` separa las dos
     cosas para que el scroll sea suave y el foco instantáneo. */
  const enfocarClave = (clave: string) => {
    const elemento = document.getElementById(idDeClave(clave))
    if (!elemento) return
    elemento.focus({ preventScroll: true })
    elemento.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  /* Cada vez que se alterna formulario ⇄ éxito, el nodo que tenía el foco se
     desmonta y el foco cae en <body>. Se compara contra el valor previo en vez de
     usar una bandera de "primer render": así la página no roba el foco al cargar y
     es inmune al doble montaje de StrictMode. */
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

  /* Foco diferido tras agregar o quitar una tarjeta: el destino recién existe
     después del render. Se limpia siempre, incluso si el nodo ya no está, para que
     un destino viejo no se dispare en un render posterior. */
  useEffect(() => {
    if (focoBotonAgregar.current) {
      focoBotonAgregar.current = false
      botonAgregarRef.current?.focus()
      return
    }
    const clave = focoPendiente.current
    if (!clave) return
    focoPendiente.current = null
    enfocarClave(clave)
  }, [jugadores])

  /* Foco tras un rechazo de la RPC. En un efecto y no en `handleSubmit` porque el
     destino puede estar deshabilitado en el momento de la respuesta: con el roster
     lleno, un 'max_jugadores' llegaría cuando el botón de agregar está `disabled`.
     La barra del roster es un contenedor —nunca se deshabilita— y es donde están
     los controles que arreglan los dos rechazos de cantidad. */
  useEffect(() => {
    if (!rechazo) return
    if (rechazo === 'equipo_duplicado' || rechazo === 'falta_equipo') {
      enfocarClave('equipo')
      return
    }
    barraRosterRef.current?.focus({ preventScroll: true })
    barraRosterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
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

  const setCampoEquipo = (campo: keyof EquipoForm, valor: string) => {
    setEquipoForm((prev) => ({ ...prev, [campo]: valor }))
    limpiarError(campo)
    /* Editar el nombre del equipo descarta el rechazo del servidor: era sobre el
       nombre anterior. Sin esto, el mensaje de "ya existe un equipo con ese
       nombre" seguiría en pantalla mientras se teclea el nombre nuevo. */
    if (campo === 'equipo') setRechazo(null)
  }

  const setCampoJugador = (uid: string, campo: CampoJugador, valor: string) => {
    setJugadores((prev) =>
      prev.map((j) => (j.uid === uid ? { ...j, [campo]: valor } : j))
    )
    limpiarError(claveJugador(uid, campo))
  }

  /* Escolaridad y Género: al salir de "Otros" se descarta el texto libre. */
  const setOpcionJugador = (uid: string, campo: 'escolaridad' | 'genero', valor: string) => {
    const campoOtro: CampoJugador =
      campo === 'escolaridad' ? 'escolaridad_otro' : 'genero_otro'
    setJugadores((prev) =>
      prev.map((j) =>
        j.uid === uid
          ? { ...j, [campo]: valor, ...(valor !== 'Otros' ? { [campoOtro]: '' } : {}) }
          : j
      )
    )
    setErrores((prev) => {
      const siguiente = { ...prev }
      delete siguiente[claveJugador(uid, campo)]
      if (valor !== 'Otros') delete siguiente[claveJugador(uid, campoOtro)]
      return siguiente
    })
  }

  /* Toda edición de un Riot ID invalida el veredicto anterior —era sobre otro valor—
     y descarta la respuesta de una validación en vuelo DE ESA ENTRADA. Vale igual para
     una tarjeta y para el capitán: lo único que cambia es la clave. */
  const invalidarRiotId = (clave: string) => {
    peticionesRiotId.current.set(clave, (peticionesRiotId.current.get(clave) ?? 0) + 1)
    /* Se limpia el veredicto guardado aunque el estado esté atado al valor: si la
       persona edita y vuelve a teclear el MISMO texto que se estaba comprobando, el
       valor coincide de nuevo pero aquella petición ya quedó descartada por el
       contador y su respuesta nunca se va a aplicar — sin esto, el indicador de
       "Validando…" giraba para siempre. No se pierde nada: al salir del campo, el
       caché repinta el veredicto sin volver a llamar. */
    setValidaciones((prev) => ({ ...prev, [clave]: VALIDACION_INACTIVA }))
    setAnunciosRiotId((prev) => ({ ...prev, [clave]: '' }))
  }

  /* El Riot ID de un jugador tiene su propio onChange: además de lo que hace
     setCampoJugador, invalida su veredicto. */
  const setGamertag = (uid: string, valor: string) => {
    setCampoJugador(uid, 'gamertag', valor)
    invalidarRiotId(uid)
  }

  /* El del capitán, lo mismo pero sobre el campo del equipo. Se guarda en
     `capitan_nombre` —la columna, la clave del payload de la RPC y el campo que
     espera ATAK NO cambian de nombre—: lo que cambió es QUÉ se guarda ahí. */
  const setCapitanRiotId = (valor: string) => {
    setCampoEquipo('capitan_nombre', valor)
    invalidarRiotId(CLAVE_CAPITAN)
  }

  /* Traduce el veredicto a lo que ve y oye la persona, siempre atado al valor que
     se comprobó y a la tarjeta que lo pidió. Es el único lugar donde
     'indeterminado' se vuelve silencio: ni tilde, ni error, ni anuncio. Es la regla
     más importante de todo esto —una validación que no se pudo hacer nunca frena
     una inscripción— y por eso vive en una sola rama.

     Ojo con lo que NO hace: no escribe en `errores`. Ese objeto significa "lo que
     encontró el último envío" y es lo que enciende el banner de abajo. */
  const aplicarVeredicto = (clave: string, valor: string, resultado: ResultadoRiotId) => {
    if (resultado === 'existe') {
      setValidaciones((prev) => ({ ...prev, [clave]: { valor, estado: 'valido' } }))
      setAnunciosRiotId((prev) => ({ ...prev, [clave]: 'Riot ID verificado.' }))
      return
    }
    if (resultado === 'no_existe') {
      setValidaciones((prev) => ({ ...prev, [clave]: { valor, estado: 'no_encontrado' } }))
      setAnunciosRiotId((prev) => ({ ...prev, [clave]: MENSAJE_RIOT_ID_NO_EXISTE }))
      return
    }
    setValidaciones((prev) => ({ ...prev, [clave]: { valor, estado: 'inactivo' } }))
    setAnunciosRiotId((prev) => ({ ...prev, [clave]: '' }))
  }

  /* Al salir del campo, no en cada tecla: es una petición de red por comprobación.
     La comprobación es ORIENTATIVA, no una barrera: con Enter dentro del campo el
     formulario se envía sin que haya blur, así que nunca corre. Es coherente con no
     bloquear nunca por la validación, pero significa que no todo lo que se manda
     pasó por acá. No asumir lo contrario. */
  const comprobarRiotId = (clave: string, valorCrudo: string) => {
    const valor = valorCrudo.trim()

    /* El formato local manda y corre primero: si ya está mal, su error es más
       accionable que cualquier respuesta remota y no se gasta una petición. */
    if (!valor || !REGEX_RIOT_ID.test(valor)) return

    /* El caché va por VALOR y lo comparten todas las entradas —el capitán más los 5 a 7
       jugadores—: si el capitán es también jugador (el caso normal), su Riot ID se
       comprueba una sola vez. */
    const cacheado = riotIdComprobado.current.get(valor)
    if (cacheado) {
      aplicarVeredicto(clave, valor, cacheado)
      return
    }

    const idPeticion = (peticionesRiotId.current.get(clave) ?? 0) + 1
    peticionesRiotId.current.set(clave, idPeticion)
    setValidaciones((prev) => ({ ...prev, [clave]: { valor, estado: 'validando' } }))
    setAnunciosRiotId((prev) => ({ ...prev, [clave]: '' }))

    /* Sin await ni try/catch: validarRiotId() no lanza por contrato y esto no debe
       bloquear nada de lo que la persona siga haciendo en el formulario. */
    void (async () => {
      const resultado = await validarRiotId(valor)
      /* Respuesta superada por otra más nueva DE ESTA ENTRADA: se tira. */
      if (peticionesRiotId.current.get(clave) !== idPeticion) return
      if (resultado !== 'indeterminado') {
        riotIdComprobado.current.set(valor, resultado)
      }
      aplicarVeredicto(clave, valor, resultado)
    })()
  }

  /* --- Alta y baja de tarjetas --- */

  const agregarJugador = () => {
    if (jugadores.length >= MAX_JUGADORES) return
    const nuevo = jugadorVacio()
    const posicion = jugadores.length + 1
    setJugadores((prev) => [...prev, nuevo])
    setRechazo(null)
    setAnuncioRoster(
      `Jugador ${posicion} agregado como ${
        posicion <= TITULARES ? 'titular' : 'suplente'
      }. El equipo tiene ${posicion} de ${MAX_JUGADORES} jugadores.`
    )
    /* Al primer campo de la tarjeta nueva: en móvil aparece fuera de pantalla y sin
       esto habría que buscarla scrolleando. */
    focoPendiente.current = claveJugador(nuevo.uid, 'gamertag')
  }

  const quitarJugador = (uid: string) => {
    if (jugadores.length <= MIN_JUGADORES) return
    const indice = jugadores.findIndex((j) => j.uid === uid)
    if (indice === -1) return

    setJugadores((prev) => prev.filter((j) => j.uid !== uid))
    setRechazo(null)

    /* Los errores y el estado de validación de la tarjeta que se va se descartan:
       si no, quedarían para siempre en los diccionarios —nada los volvería a
       tocar— y el recuento de errores contaría campos que ya no existen. */
    setErrores((prev) => {
      const siguiente = { ...prev }
      for (const campo of CAMPOS_JUGADOR) delete siguiente[claveJugador(uid, campo)]
      return siguiente
    })
    setValidaciones((prev) => {
      const siguiente = { ...prev }
      delete siguiente[uid]
      return siguiente
    })
    setAnunciosRiotId((prev) => {
      const siguiente = { ...prev }
      delete siguiente[uid]
      return siguiente
    })
    peticionesRiotId.current.delete(uid)

    const quedan = jugadores.length - 1
    setAnuncioRoster(
      `Jugador ${indice + 1} eliminado. El equipo tiene ${quedan} ${
        quedan === 1 ? 'jugador' : 'jugadores'
      }. Los que estaban debajo cambiaron de número.`
    )
    /* El foco caería a <body> porque el botón que se acaba de usar se desmontó.
       Va al botón de agregar, que está al lado del roster y siempre montado — pero
       DIFERIDO al efecto de más arriba, no acá: con el roster en 7 el botón todavía
       tiene `disabled` en el DOM mientras corre este handler (el re-render que lo
       habilita no ocurrió), y `.focus()` sobre un control deshabilitado no hace
       nada. Justo el caso más frecuente: quitar a alguien con el roster lleno. */
    focoBotonAgregar.current = true
  }

  /* --- Validación --- */

  const validar = (): Errores => {
    const e: Errores = {}

    if (!equipoForm.equipo.trim()) e.equipo = 'Escribe el nombre del equipo.'
    /* `capitan_nombre` guarda el RIOT ID del capitán, no su nombre: es lo que espera
       ATAK en ese campo. Se valida con el mismo REGEX_RIOT_ID que los jugadores y con
       las mismas dos ramas —formato primero, veredicto remoto después—, para que todas
       las comprobaciones del formulario se comporten igual. */
    const capitanRiotId = equipoForm.capitan_nombre.trim()
    if (!capitanRiotId) {
      e.capitan_nombre = 'Escribe el Riot ID del capitán.'
    } else if (!REGEX_RIOT_ID.test(capitanRiotId)) {
      e.capitan_nombre =
        'Riot ID completo, con nombre y tag: nombre#tag (por ejemplo, Capitan#MX1).'
    } else if (estadoRiotIdDe(CLAVE_CAPITAN, capitanRiotId) === 'no_encontrado') {
      e.capitan_nombre = MENSAJE_RIOT_ID_NO_EXISTE
    }
    const errorCapitan = validarTelefono(
      equipoForm.capitan_celular,
      'Escribe el celular del capitán.'
    )
    if (errorCapitan) e.capitan_celular = errorCapitan

    const hoy = fechaLocalISO(new Date())
    const maxNacimiento = fechaMaximaNacimiento()
    const minNacimiento = fechaMinimaNacimiento()

    for (const j of jugadores) {
      const poner = (campo: CampoJugador, mensaje: string) => {
        e[claveJugador(j.uid, campo)] = mensaje
      }

      const gamertag = j.gamertag.trim()
      if (!gamertag) {
        poner('gamertag', 'Escribe el Riot ID.')
      } else if (!REGEX_RIOT_ID.test(gamertag)) {
        poner(
          'gamertag',
          'Riot ID completo, con nombre y tag: nombre#tag (por ejemplo, Jugador#MX1).'
        )
      } else if (estadoRiotIdDe(j.uid, j.gamertag) === 'no_encontrado') {
        /* El veredicto remoto se suma acá y no aparte: solo si el formato ya pasó.
           Ante los dos problemas, el de formato es el más accionable.
           Lo que NO frena el envío, a propósito: una comprobación en vuelo
           ('validando') y una que no se pudo hacer ('inactivo'). */
        poner('gamertag', MENSAJE_RIOT_ID_NO_EXISTE)
      }

      if (!j.nombre.trim()) poner('nombre', 'Escribe el nombre completo.')

      /* Orden de ramas: de lo más específico a lo más general, para que cada caso
         dé su propio mensaje. El piso va último: un año tecleado a medias ("0206")
         cae ahí y el mensaje apunta al año, no a la edad. */
      if (!j.fecha_nacimiento) {
        poner('fecha_nacimiento', 'Selecciona la fecha de nacimiento.')
      } else if (j.fecha_nacimiento > hoy) {
        poner('fecha_nacimiento', 'La fecha no puede ser futura.')
      } else if (j.fecha_nacimiento > maxNacimiento) {
        poner(
          'fecha_nacimiento',
          `Cada jugador debe tener al menos ${EDAD_MINIMA} años cumplidos.`
        )
      } else if (j.fecha_nacimiento < minNacimiento) {
        poner('fecha_nacimiento', 'Revisa el año de nacimiento.')
      }

      const errorCelular = validarTelefono(j.celular, 'Escribe el número de celular.')
      if (errorCelular) poner('celular', errorCelular)

      if (!j.correo.trim()) {
        poner('correo', 'Escribe el correo electrónico.')
      } else if (!REGEX_CORREO.test(j.correo.trim())) {
        poner('correo', 'El correo no tiene un formato válido (ejemplo: nombre@correo.com).')
      }

      if (!j.municipio.trim()) poner('municipio', 'Escribe el municipio.')

      if (!j.escolaridad) poner('escolaridad', 'Selecciona la escolaridad.')
      if (j.escolaridad === 'Otros' && !j.escolaridad_otro.trim()) {
        poner('escolaridad_otro', 'Especifica la escolaridad.')
      }

      if (!j.genero) poner('genero', 'Selecciona el género.')
      if (j.genero === 'Otros' && !j.genero_otro.trim()) {
        poner('genero_otro', 'Especifica el género.')
      }
    }

    /* Riot ID repetido dentro del roster. Esta comprobación no existía —ni podía—
       en el modelo viejo: cada envío traía UN jugador y nadie veía el equipo
       completo. Ahora el capitán llena 7 tarjetas parecidas en un teléfono y
       duplicar una por copiar y pegar sin cambiar el tag es de lo más fácil.
       No lo cubre ninguno de los cuatro códigos de rechazo de la RPC, así que sin
       esto el equipo entra con el mismo jugador dos veces y del lado de ATAK
       termina probablemente en un 409 mudo (ver docs/INTEGRACION-ATAK.md).
       Se compara en minúsculas por el mismo criterio con el que la base compara
       nombres de equipo. El error va en el DUPLICADO, no en el primero: el primero
       no tiene nada malo. */
    const riotIdVistos = new Map<string, number>()
    jugadores.forEach((j, i) => {
      const clave = j.gamertag.trim().toLowerCase()
      if (!clave) return
      const primero = riotIdVistos.get(clave)
      if (primero === undefined) {
        riotIdVistos.set(clave, i)
        return
      }
      /* No pisa un error de formato ya puesto: ese es más accionable. */
      const claveError = claveJugador(j.uid, 'gamertag')
      if (!e[claveError]) {
        e[claveError] = `Este Riot ID ya está en el jugador ${primero + 1}. Cada jugador debe ser distinto.`
      }
    })

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
      const primera = ordenClaves().find((clave) => nuevosErrores[clave])
      if (primera) enfocarClave(primera)
      return
    }

    /* Escolaridad y Género se mandan resueltos: si se eligió "Otros", el valor
       final es el texto especificado, no la etiqueta genérica. Los celulares van
       normalizados a 10 dígitos, sin separadores.
       El ORDEN del array es el contrato: la RPC asigna titular/suplente por
       posición, así que se manda tal cual está en pantalla. */
    const payload: PayloadRegistro = {
      equipo: equipoForm.equipo.trim(),
      capitan_nombre: equipoForm.capitan_nombre.trim(),
      capitan_celular: soloDigitos(equipoForm.capitan_celular),
      jugadores: jugadores.map((j) => ({
        gamertag: j.gamertag.trim(),
        nombre: j.nombre.trim(),
        fecha_nacimiento: j.fecha_nacimiento,
        celular: soloDigitos(j.celular),
        correo: j.correo.trim(),
        municipio: j.municipio.trim(),
        escolaridad: j.escolaridad === 'Otros' ? j.escolaridad_otro.trim() : j.escolaridad,
        genero: j.genero === 'Otros' ? j.genero_otro.trim() : j.genero
      }))
    }

    setEnviando(true)
    try {
      /* Sin credenciales de Supabase el cliente viene en `null` (el build salió sin
         las VITE_*). Es un fallo de envío más: mismo banner genérico. */
      const supabase = obtenerSupabase()
      if (!supabase) {
        setErrorEnvio(true)
        return
      }

      /* Todo el registro entra por esta RPC: es la única superficie que el cliente
         anónimo puede tocar. NO se intenta un `.select()` de vuelta —la RLS no le
         da lectura sobre `equipos` ni `jugadores`— y no hace falta: la función
         devuelve el veredicto en su propio valor de retorno.
         El `abortSignal` corta a los 15 s: sin él, un backend colgado deja el botón
         en "Enviando…" hasta el timeout del navegador. El aborto vuelve como
         `error` en la respuesta, así que cae en la misma rama de abajo. */
      const { data, error } = await supabase
        .rpc('registrar_equipo', { datos: payload })
        .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_ENVIO_MS))

      if (error) {
        setErrorEnvio(true)
        return
      }

      const respuesta = leerRespuesta(data)

      if (respuesta === 'ok') {
        setEnviado(true)
        return
      }

      /* Una respuesta que no se entiende se trata como fallo genérico: es lo único
         honesto que se puede decir de algo que no sabemos leer. */
      if (respuesta === 'desconocido') {
        setErrorEnvio(true)
        return
      }

      /* El foco lo mueve el efecto de `[rechazo]`: acá el destino todavía no está
         renderizado ni necesariamente habilitado. */
      setRechazo(respuesta)
    } catch {
      /* Fallo de red o de configuración. No se captura el error ni se registra en
         consola: el payload son datos personales de varias personas y el mensaje al
         usuario es genérico a propósito. */
      setErrorEnvio(true)
    } finally {
      /* En `finally` para que un fallo de red no deje el botón trabado. */
      setEnviando(false)
    }
  }

  const reiniciar = () => {
    setEquipoForm(EQUIPO_VACIO)
    setJugadores(Array.from({ length: MIN_JUGADORES }, jugadorVacio))
    setErrores({})
    setAceptaPrivacidad(false)
    setErrorEnvio(false)
    setRechazo(null)
    setEnviado(false)
    setAnuncioRoster('')
    /* El estado del Riot ID también se limpia, para que una comprobación del equipo
       anterior que llegue tarde no pinte su veredicto sobre el formulario nuevo. El
       caché de veredictos por VALOR sobrevive a propósito: sigue siendo cierto.

       OJO con el contador del capitán. Para los jugadores, `clear()` alcanza: sus
       claves son uid nuevos (`contadorUid` nunca vuelve atrás), así que una respuesta
       vieja busca su clave, no la encuentra y se descarta sola. `CLAVE_CAPITAN`, en
       cambio, es CONSTANTE y se reutiliza en el formulario siguiente: si se reiniciara
       a 0, una respuesta en vuelo del equipo anterior podría volver a coincidir con el
       `idPeticion` del nuevo, pasar el guard y pintar un veredicto que no es de este
       formulario. Por eso su contador no se borra: se incrementa. */
    const peticionesCapitan = peticionesRiotId.current.get(CLAVE_CAPITAN) ?? 0
    peticionesRiotId.current.clear()
    peticionesRiotId.current.set(CLAVE_CAPITAN, peticionesCapitan + 1)
    setValidaciones({})
    setAnunciosRiotId({})
  }

  /* --- Derivados de render --- */

  const hayErrores = Object.keys(errores).length > 0

  /* Estado efectivo de la comprobación del Riot ID del capitán, con la misma regla que
     las tarjetas: el veredicto guardado solo vale si sigue siendo sobre lo que hay
     escrito AHORA en el campo. */
  const estadoCapitan = estadoRiotIdDe(CLAVE_CAPITAN, equipoForm.capitan_nombre)

  /* Qué tarjetas tienen algo mal, para poder decirlo en el banner. En un formulario
     de 7 jugadores, "revisa los campos marcados" obliga a recorrer toda la página
     en el teléfono; el número de jugador es lo que convierte el aviso en accionable. */
  const jugadoresConError = jugadores
    .map((j, i) => ({
      numero: i + 1,
      tiene: CAMPOS_JUGADOR.some((campo) => errores[claveJugador(j.uid, campo)])
    }))
    .filter((x) => x.tiene)
    .map((x) => x.numero)

  /* Error del campo «equipo» derivado del rechazo del servidor. Derivado y no
     guardado en `errores` por lo mismo que el Riot ID: ese objeto enciende el banner
     de validación local, que acá no corresponde —el formulario estaba bien, lo
     rechazó la base—. */
  const errorEquipoServidor = rechazo ? MENSAJE_RECHAZO_CAMPO[rechazo] : undefined

  /* Reparto titular/suplente tal como lo va a aplicar la RPC, para poder confirmarlo
     en la pantalla de éxito. Es la misma regla de las pastillas de cada tarjeta. */
  const titularesEnviados = Math.min(jugadores.length, TITULARES)
  const suplentesEnviados = jugadores.length - titularesEnviados

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
        <section className="py-32 md:py-40">
          <div className="container mx-auto px-6 max-w-4xl text-center">
            <h1 className="text-5xl md:text-7xl font-extralight tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-blue-300 to-lqc-accent mb-6">
              LQC Split Otoño 2026
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
              El capitán registra al equipo completo en un solo envío.
            </p>
          </div>
        </section>

        {/* Formulario */}
        <section className="pb-28">
          <div className="container mx-auto px-6 max-w-4xl">
            {enviado ? (
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
                  ¡Equipo registrado!
                </h2>
                {/* Devolución concreta de lo que se acaba de enviar. Después de hasta
                    73 campos, "recibimos tu registro" no alcanza para saber que el
                    roster salió como se pretendía. Sale del estado, que todavía está
                    lleno —`reiniciar()` no corrió—, así que no inventa nada: son los
                    mismos datos que se mandaron. Nada de fechas ni de próximos pasos
                    que no estén confirmados. */}
                <p className="text-gray-300 mb-4 max-w-lg mx-auto leading-relaxed">
                  Registramos a{' '}
                  <span className="text-white font-medium">{equipoForm.equipo.trim()}</span>{' '}
                  con {jugadores.length} jugadores: {titularesEnviados} titulares
                  {suplentesEnviados > 0 && (
                    <>
                      {' '}
                      y {suplentesEnviados}{' '}
                      {suplentesEnviados === 1 ? 'suplente' : 'suplentes'}
                    </>
                  )}
                  .
                </p>
                <p className="text-gray-300 mb-10 max-w-lg mx-auto leading-relaxed">
                  Te contactaremos al celular del capitán para confirmar la inscripción
                  y el pago.
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

                <button
                  type="button"
                  onClick={reiniciar}
                  className="bg-none px-8 py-4 bg-black/50 border border-blue-800/40 text-gray-200 rounded-xl hover:bg-blue-950/40 hover:border-blue-600/60 hover:text-white transition-all duration-300"
                >
                  Registrar otro equipo
                </button>
              </div>
            ) : (
              /* ---------- Formulario ---------- */
              <form onSubmit={handleSubmit} noValidate className="space-y-12">
                {/* Datos del equipo */}
                <div>
                  <TituloSeccion>Datos del Equipo</TituloSeccion>
                  <div className={CLASE_TARJETA}>
                    <div className="grid md:grid-cols-2 gap-6">
                      <CampoTexto
                        id="equipo"
                        label="Nombre del equipo"
                        icono={Users}
                        valor={equipoForm.equipo}
                        onChange={(v) => setCampoEquipo('equipo', v)}
                        error={errores.equipo ?? errorEquipoServidor}
                        placeholder="Nombre de tu equipo"
                        claseContenedor="md:col-span-2"
                      />
                      {/* El capitán se identifica por su RIOT ID, no por su nombre: es
                          lo que ATAK espera en este campo. El id, la clave del estado,
                          la columna y la clave del payload de la RPC siguen llamándose
                          `capitan_nombre` — renombrarlos obligaría a tocar
                          `registrar_equipo` y `armar_roster_atak`, que viven en la base
                          y no en el repo. Cambia lo que se guarda, no cómo se llama. */}
                      {/* `md:col-span-2` por la misma razón que el Riot ID de las
                          tarjetas: la ayuda de formato son tres líneas y en media
                          columna dejaría al campo de al lado con un hueco vertical. */}
                      <div className="md:col-span-2">
                        <CampoTexto
                          id="capitan_nombre"
                          label="Riot ID del Capitán"
                          icono={Gamepad2}
                          valor={equipoForm.capitan_nombre}
                          onChange={setCapitanRiotId}
                          /* Misma composición que en las tarjetas: el error del envío
                             manda y, si no hay, se deriva del veredicto remoto. */
                          error={
                            errores.capitan_nombre ??
                            (estadoCapitan === 'no_encontrado'
                              ? MENSAJE_RIOT_ID_NO_EXISTE
                              : undefined)
                          }
                          placeholder="Capitan#MX1"
                          autoComplete="off"
                          describedById="capitan_nombre-ayuda"
                          onBlur={() =>
                            comprobarRiotId(CLAVE_CAPITAN, equipoForm.capitan_nombre)
                          }
                          sufijo={
                            estadoCapitan === 'validando' ? (
                              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                            ) : estadoCapitan === 'valido' ? (
                              <Check className="w-5 h-5 text-green-400" />
                            ) : null
                          }
                        />
                        <p id="capitan_nombre-ayuda" className="mt-2 text-sm text-gray-400">
                          Riot ID completo: nombre, luego #, luego tag (por ejemplo,
                          Capitan#MX1). Si el capitán también juega, es el mismo que pondrá
                          en su tarjeta del roster.
                        </p>
                        {/* Región viva propia, como la de cada tarjeta: el resultado llega
                            con el foco ya en otro campo. */}
                        <span role="status" aria-live="polite" className="sr-only">
                          {anunciosRiotId[CLAVE_CAPITAN] ?? ''}
                        </span>
                      </div>
                      <CampoTexto
                        id="capitan_celular"
                        label="Celular del Capitán"
                        icono={Phone}
                        tipo="tel"
                        valor={equipoForm.capitan_celular}
                        onChange={(v) => setCampoEquipo('capitan_celular', v)}
                        error={errores.capitan_celular}
                        placeholder="10 dígitos"
                        autoComplete="tel"
                      />
                    </div>
                  </div>
                </div>

                {/* Roster */}
                <div>
                  <TituloSeccion>Roster</TituloSeccion>

                  {/* Barra de control del roster. Va ARRIBA de las tarjetas: en
                      móvil, después de 7 tarjetas el botón de agregar quedaría a
                      varias pantallas de distancia del contador que lo justifica. */}
                  {/* tabIndex -1: destino de foco programático tras un rechazo de
                      cantidad de la RPC. No es tabulable. */}
                  <div
                    ref={barraRosterRef}
                    tabIndex={-1}
                    className="mb-8 scroll-mt-28 rounded-2xl border border-blue-800/30 bg-blue-950/20 p-5 md:p-6 focus:outline-none"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-white font-medium">
                          {jugadores.length} de {MAX_JUGADORES} jugadores
                        </p>
                        <p id={ID_LIMITES_ROSTER} className="mt-1 text-sm text-gray-400">
                          Mínimo {MIN_JUGADORES}, máximo {MAX_JUGADORES}.
                        </p>
                      </div>
                      <button
                        type="button"
                        ref={botonAgregarRef}
                        onClick={agregarJugador}
                        disabled={jugadores.length >= MAX_JUGADORES}
                        className={CLASE_BOTON_AGREGAR}
                      >
                        <UserPlus className="w-4 h-4 shrink-0" aria-hidden="true" />
                        Agregar jugador
                      </button>
                    </div>

                    <p className="mt-4 text-sm text-gray-300 leading-relaxed">
                      El orden de las tarjetas es el que se envía: los{' '}
                      <span className="text-white font-medium">
                        primeros {TITULARES} quedan como titulares
                      </span>{' '}
                      y del {TITULARES + 1}º en adelante como suplentes. Si quitas a
                      alguien, los de abajo suben de número y pueden cambiar de rol.
                    </p>

                    {/* Alta y baja de tarjetas no mueven el foco a un sitio que lo
                        explique, así que se anuncian acá. `polite`: no interrumpe lo
                        que se esté leyendo. */}
                    <span role="status" aria-live="polite" className="sr-only">
                      {anuncioRoster}
                    </span>
                  </div>

                  <div className="space-y-8">
                    {jugadores.map((jugador, indice) => (
                      <TarjetaJugador
                        /* key por uid y NO por índice: con el índice, quitar la
                           tarjeta 2 haría que React reusara sus inputs para los datos
                           del jugador 3 y el DOM quedaría desfasado del estado. */
                        key={jugador.uid}
                        jugador={jugador}
                        indice={indice}
                        total={jugadores.length}
                        errores={errores}
                        estadoRiotId={estadoRiotIdDe(jugador.uid, jugador.gamertag)}
                        anuncioRiotId={anunciosRiotId[jugador.uid] ?? ''}
                        onCampo={setCampoJugador}
                        onOpcion={setOpcionJugador}
                        onGamertag={setGamertag}
                        onComprobarRiotId={comprobarRiotId}
                        onQuitar={quitarJugador}
                      />
                    ))}
                  </div>

                  {/* Segundo botón de agregar, DESPUÉS de la última tarjeta. El de
                      arriba sirve para dimensionar el roster antes de empezar; este
                      es para el recorrido real: llenar las tarjetas de arriba abajo
                      y darse cuenta al final de que falta un suplente. En ese
                      momento, en un teléfono, el botón de arriba está a varias
                      pantallas completas de distancia.
                      Es un botón real y no un atajo visual, y se oculta al llegar al
                      máximo en vez de deshabilitarse: acá abajo no hay contador al
                      lado que explique por qué estaría apagado. Si se desmonta con
                      el foco puesto no se pierde nada — quien lo pulsó acaba de
                      mandar el foco a la tarjeta nueva. */}
                  {jugadores.length < MAX_JUGADORES && (
                    <div className="mt-8 flex justify-center">
                      <button
                        type="button"
                        onClick={agregarJugador}
                        className={CLASE_BOTON_AGREGAR}
                      >
                        <UserPlus className="w-4 h-4 shrink-0" aria-hidden="true" />
                        Agregar jugador {jugadores.length + 1}
                      </button>
                    </div>
                  )}
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
                    formulario: en este punto el capitán ya armó el roster y está a un
                    paso de enviar, que es cuando de verdad le sirve saber si su equipo
                    es elegible. Arriba lo leería antes de tener a quién comparar contra
                    los requisitos.
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
                        {/* «registrar tu equipo» y no «enviar»: es la acción que nombra el
                            botón de abajo, que dice «Registrar equipo». */}
                        <p className="text-lg md:text-xl font-medium text-white mb-2">
                          Léelo antes de registrar tu equipo
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
                          guardado, así que navegar en la misma pestaña le borra el roster.
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
                           el texto no dice. Misma fórmula que los enlaces de comunidad de
                           más arriba en este archivo. */
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
                        eso y `PayloadRegistro` es un tipo cerrado. (Contacto sí hay —el
                        payload manda celular y correo de cada jugador—, así que el problema
                        no es no poder avisar: es que no quedaría registro de qué se aceptó.)
                        Mejor ofrecer el reglamento sin exigir aceptación que exigir una
                        aceptación que no dice de qué.

                        Cuando el PDF quede firme, esto es lo que hay que sumar. OJO: las
                        cinco cosas son de cliente nomás, igual que `aceptaPrivacidad`, que
                        tampoco se persiste. Si lo que se quiere es una aceptación
                        REGISTRADA con fecha y versión, eso además necesita columna nueva y
                        cambiar la RPC `registrar_equipo`, que vive en Supabase y no en este
                        repo (ver AGENTS.md).
                          1. estado `aceptaReglamento` + su `setState`;
                          2. el `id` del input DEBE ser igual a la clave de error
                             ('reglamento'): `enfocarClave` hace getElementById y si no lo
                             encuentra sale por un `return` sin error, o sea que el foco al
                             primer campo inválido se rompe EN SILENCIO;
                          3. la clave 'reglamento' en `ordenClaves()`, y va ANTES de
                             'privacidad', no al final: ese arreglo es el orden VISUAL y de
                             ahí sale a qué campo salta el foco;
                          4. la validación dentro de `validar()`, con el mismo patrón que
                             `if (!aceptaPrivacidad)`;
                          5. el reset dentro de `reiniciar()`, junto a
                             `setAceptaPrivacidad(false)`.
                        Copiar el bloque del checkbox del aviso de privacidad de abajo: ya
                        tiene el input sr-only + `peer`, el foco visible y el MensajeError
                        cableados. (El tipo de errores no hay que tocarlo: `Errores` es
                        `Record<string, string>`, cualquier clave ya es válida.) */}
                  </div>
                </div>

                {/* Aviso de privacidad.
                    AJUSTADO AL MODELO NUEVO: antes cada persona enviaba sus propios
                    datos y el texto hablaba en segunda persona singular ("tus datos",
                    "como titular puedes"). Ahora quien envía es el capitán y los datos
                    son DE TERCEROS —hasta 6 personas que no están tocando el
                    formulario—, así que el consentimiento que se marca abajo ya no
                    puede ser solo el suyo: tiene que declarar que cuenta con el de
                    cada integrante. Los derechos ARCO siguen siendo de cada titular,
                    no del capitán, y el texto ahora lo dice. */}
                <div>
                  <TituloSeccion>Aviso de Privacidad</TituloSeccion>
                  <div className="bg-black/40 backdrop-blur-sm border border-lqc-accent/20 rounded-2xl p-6 md:p-8 shadow-lqc">
                    <div className="flex items-start gap-4 mb-6">
                      <div className="w-12 h-12 rounded-xl bg-black/40 border border-lqc-accent/30 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-6 h-6 text-lqc-accent" />
                      </div>
                      <p className="text-gray-300 leading-relaxed text-sm md:text-base">
                        Los datos personales de todas las personas registradas en este
                        formulario se tratan conforme a la{' '}
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
                          Los datos{' '}
                          <span className="text-white font-medium">
                            no se comparten con terceros
                          </span>{' '}
                          sin el consentimiento de cada titular.
                        </span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-lqc-accent mt-2.5 shrink-0" />
                        <span className="text-gray-300">
                          Cada persona registrada, y no solo quien llena este formulario,
                          puede ejercer sus{' '}
                          <span className="text-white font-medium">
                            derechos ARCO (acceso, rectificación, cancelación u oposición)
                          </span>{' '}
                          sobre sus propios datos. Para hacerlo, puede escribir a{' '}
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

                    {/* Consentimiento: UNO para todo el envío, no uno por jugador.
                        El texto es lo que cambia respecto del modelo viejo: quien
                        marca la casilla no está consintiendo solo por sí mismo, está
                        declarando que tiene autorización de cada integrante. Sin esa
                        declaración, el capitán estaría enviando datos de terceros sin
                        base para hacerlo. */}
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
                          Confirmo que cada integrante del equipo me autorizó a registrar
                          sus datos, y acepto su tratamiento conforme al aviso de
                          privacidad.{' '}
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
                        No pudimos enviar el registro: falta información o hay datos que
                        revisar.{' '}
                        {jugadoresConError.length > 0 && (
                          <>
                            Revisa{' '}
                            {jugadoresConError.length === 1
                              ? `el jugador ${jugadoresConError[0]}`
                              : `los jugadores ${jugadoresConError.slice(0, -1).join(', ')} y ${
                                  jugadoresConError[jugadoresConError.length - 1]
                                }`}
                            .{' '}
                          </>
                        )}
                        Los campos con problemas tienen un mensaje debajo.
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
                        {rechazo === 'equipo_duplicado' && (
                          <>
                            {' '}
                            Si alguien de tu equipo ya lo registró, no lo registres de
                            nuevo: escríbenos a{' '}
                            <a
                              href="mailto:contactolqc@revolution505.com"
                              className="after:hidden text-lqc-accent font-medium underline underline-offset-4 decoration-lqc-accent/40 hover:decoration-lqc-accent"
                            >
                              contactolqc@revolution505.com
                            </a>{' '}
                            y lo verificamos. Si es otro equipo, elige un nombre distinto.
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
                        No pudimos enviar el registro. Revisa tu conexión e inténtalo de
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
                        Registrar equipo
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
