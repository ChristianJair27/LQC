import { useEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Users, Gamepad2, User, Calendar, Phone, GraduationCap,
  MapPin, Map, Mail, UserCircle, ShieldCheck, CreditCard,
  Send, CheckCircle, AlertCircle, Check, Facebook, MessageSquare,
  Loader2
} from 'lucide-react'
import { obtenerSupabase } from '../lib/supabase'

/* ------------------------------------------------------------------ */
/*  Estado del formulario                                              */
/* ------------------------------------------------------------------ */

type FormState = {
  equipo: string
  gamertag: string
  nombre: string
  fecha_nacimiento: string
  celular: string
  escolaridad: string
  escolaridad_otro: string
  municipio: string
  localidad: string
  correo: string
  genero: string
  genero_otro: string
  capitan_nombre: string
  capitan_celular: string
}

type CampoError = keyof FormState | 'privacidad'
type FormErrors = Partial<Record<CampoError, string>>

/* Contrato con las columnas de la tabla `inscripciones`. Son 12 claves: ni una
   más (los campos `*_otro` se resuelven antes de enviar) ni una menos.

   Existe porque el cliente está tipado como `SupabaseClient` sin un `Database`
   generado, o sea que `.from()` e `.insert()` aceptan literalmente cualquier
   cosa: sin esta anotación, un typo en una clave compila sin chistar y solo
   falla en runtime, con el banner genérico y sin pista de la causa. Anotar el
   objeto literal activa el chequeo de propiedades en exceso de TypeScript, así
   que una clave de más también es error de compilación.

   DEUDA: lo correcto a futuro es generar los tipos del esquema con
   `supabase gen types typescript` y pasarlos como `SupabaseClient<Database>`,
   cuando haya acceso al proyecto de Supabase. */
type InscripcionPayload = {
  equipo: string
  gamertag: string
  nombre: string
  fecha_nacimiento: string
  celular: string
  escolaridad: string
  municipio: string
  localidad: string
  correo: string
  genero: string
  capitan_nombre: string
  capitan_celular: string
}

const FORM_VACIO: FormState = {
  equipo: '',
  gamertag: '',
  nombre: '',
  fecha_nacimiento: '',
  celular: '',
  escolaridad: '',
  escolaridad_otro: '',
  municipio: '',
  localidad: '',
  correo: '',
  genero: '',
  genero_otro: '',
  capitan_nombre: '',
  capitan_celular: ''
}

const OPCIONES_ESCOLARIDAD = ['Secundaria', 'Prepa', 'Universidad', 'Otros']
const OPCIONES_GENERO = ['Masculino', 'Femenino', 'Otros']

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/* Riot ID completo: nombre (3–16 caracteres, cualquiera menos '#') + '#' + tag (2–5
   alfanuméricos). Se valida sobre el valor con trim(); las mayúsculas se conservan. */
const REGEX_RIOT_ID = /^[^#]{3,16}#[A-Za-z0-9]{2,5}$/

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

/* Techo del envío: pasado ese tiempo el insert se aborta y se muestra el error
   genérico, en vez de dejar el botón en "Enviando…" hasta el timeout del
   navegador (que puede ser de minutos). */
const TIEMPO_LIMITE_ENVIO_MS = 15_000

/* Orden visual de los campos (1–12 del formulario, con los condicionales y el
   consentimiento intercalados donde aparecen en pantalla). Se usa para mover el
   foco al primer campo inválido: las claves del objeto de errores no garantizan
   este orden. */
const ORDEN_CAMPOS: CampoError[] = [
  'equipo',
  'gamertag',
  'nombre',
  'fecha_nacimiento',
  'celular',
  'escolaridad',
  'escolaridad_otro',
  'municipio',
  'localidad',
  'correo',
  'genero',
  'genero_otro',
  'capitan_nombre',
  'capitan_celular',
  'privacidad'
]

/* ------------------------------------------------------------------ */
/*  Piezas de UI reutilizables (a nivel de módulo para no remontar los  */
/*  inputs en cada render y no perder el foco al escribir)              */
/* ------------------------------------------------------------------ */

const CLASE_INPUT_BASE =
  'w-full pl-12 pr-4 py-3.5 bg-black/40 backdrop-blur-sm border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-1 transition-all'
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
  id: keyof FormState
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
  /* id(s) que describen el input vía aria-describedby (p. ej. una ayuda de formato).
     Opcional: los demás campos no lo pasan y se renderizan igual que antes. */
  describedById?: string
}

function CampoTexto({
  id, label, icono: Icono, valor, onChange, error,
  tipo = 'text', placeholder, autoComplete, min, max,
  claseContenedor = '', claseInput = '', describedById
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
          placeholder={placeholder}
          autoComplete={autoComplete}
          min={min}
          max={max}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={
            [describedById, error ? idError : null].filter(Boolean).join(' ') || undefined
          }
          className={`${CLASE_INPUT_BASE} ${error ? CLASE_INPUT_ERROR : CLASE_INPUT_OK} ${claseInput}`}
        />
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

/* Pastillas de comunidad del estado de éxito. `after:hidden` desactiva la barra
   de gradiente que la regla base `a::after` de index.css dibuja en hover: acá el
   enlace ya tiene borde propio y quedaría un subrayado de más. El anillo de foco
   va explícito en cian de marca, como el resto del sitio (index.css le da ese
   outline a los <button>, pero los <a> se quedarían con el del navegador). */
const CLASE_ENLACE_COMUNIDAD =
  'after:hidden inline-flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl ' +
  'bg-black/40 border border-white/10 text-blue-300 ' +
  'hover:text-white hover:bg-blue-950/40 hover:border-blue-500/50 transition-all duration-300 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lqc-accent/60 ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-black'

/* ------------------------------------------------------------------ */
/*  Página                                                             */
/* ------------------------------------------------------------------ */

export default function Registro() {
  const [form, setForm] = useState<FormState>(FORM_VACIO)
  const [errores, setErrores] = useState<FormErrors>({})
  const [aceptaPrivacidad, setAceptaPrivacidad] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  /* Bandera, no el error real: el mensaje que se muestra es literal en el JSX,
     así que ningún detalle técnico del backend puede filtrarse a la pantalla. */
  const [errorEnvio, setErrorEnvio] = useState(false)
  const tituloExitoRef = useRef<HTMLHeadingElement>(null)
  const tarjetaExitoRef = useRef<HTMLDivElement>(null)
  const enviadoPrevio = useRef(enviado)

  /* Cada vez que se alterna formulario ⇄ éxito, el nodo que tenía el foco se
     desmonta y el foco cae en <body>: el usuario de teclado queda al principio
     del documento y el scroll, donde estaba. Va en un efecto y no en los
     handlers porque el nodo destino recién existe después del render.
     Se compara contra el valor previo en vez de usar una bandera de "primer
     render": el foco solo se mueve cuando `enviado` cambió de verdad. Así la
     página no roba el foco al cargar (que molestaría más que el bug original)
     y es inmune al doble montaje de StrictMode, donde una bandera de un solo
     uso ya vendría consumida en el segundo pase.
     preventScroll separa foco de scroll, como en el foco de errores. */
  useEffect(() => {
    if (enviadoPrevio.current === enviado) return
    enviadoPrevio.current = enviado

    if (enviado) {
      /* La tarjeta lleva `scroll-mt-28` para que el header sticky no la tape. */
      tituloExitoRef.current?.focus({ preventScroll: true })
      tarjetaExitoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    /* Vuelta al formulario desde el éxito: al primer campo. */
    const primerCampo = document.getElementById(ORDEN_CAMPOS[0])
    primerCampo?.focus({ preventScroll: true })
    primerCampo?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [enviado])

  /* Al corregir un campo se limpia solo su error */
  const setCampo = (campo: keyof FormState, valor: string) => {
    setForm((prev) => ({ ...prev, [campo]: valor }))
    setErrores((prev) => {
      if (!prev[campo]) return prev
      const siguiente = { ...prev }
      delete siguiente[campo]
      return siguiente
    })
  }

  /* Escolaridad y Género: al salir de "Otros" se descarta el texto libre */
  const setOpcion = (campo: 'escolaridad' | 'genero', valor: string) => {
    const campoOtro = campo === 'escolaridad' ? 'escolaridad_otro' : 'genero_otro'
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

  const validar = (): FormErrors => {
    const e: FormErrors = {}

    if (!form.equipo.trim()) e.equipo = 'Escribe el nombre de tu equipo.'
    const gamertagTrim = form.gamertag.trim()
    if (!gamertagTrim) {
      e.gamertag = 'Escribe tu Riot ID.'
    } else if (!REGEX_RIOT_ID.test(gamertagTrim)) {
      e.gamertag =
        'Escribe tu Riot ID completo, con nombre y tag: nombre#tag (por ejemplo, Jugador#MX1).'
    }
    if (!form.nombre.trim()) e.nombre = 'Escribe tu nombre completo.'

    /* Orden de ramas: de lo más específico a lo más general, para que cada caso
       dé su propio mensaje. El piso va último: un año tecleado a medias
       ("0206") cae ahí y el mensaje apunta al año, no a la edad. */
    if (!form.fecha_nacimiento) {
      e.fecha_nacimiento = 'Selecciona tu fecha de nacimiento.'
    } else if (form.fecha_nacimiento > fechaLocalISO(new Date())) {
      e.fecha_nacimiento = 'La fecha no puede ser futura.'
    } else if (form.fecha_nacimiento > fechaMaximaNacimiento()) {
      e.fecha_nacimiento = `Debes tener al menos ${EDAD_MINIMA} años cumplidos para registrarte.`
    } else if (form.fecha_nacimiento < fechaMinimaNacimiento()) {
      e.fecha_nacimiento = 'Revisa el año de nacimiento.'
    }

    const errorCelular = validarTelefono(form.celular, 'Escribe tu número de celular.')
    if (errorCelular) e.celular = errorCelular

    if (!form.escolaridad) e.escolaridad = 'Selecciona tu escolaridad.'
    if (form.escolaridad === 'Otros' && !form.escolaridad_otro.trim()) {
      e.escolaridad_otro = 'Especifica tu escolaridad.'
    }

    if (!form.municipio.trim()) e.municipio = 'Escribe tu municipio.'
    if (!form.localidad.trim()) e.localidad = 'Escribe tu localidad.'

    if (!form.correo.trim()) {
      e.correo = 'Escribe tu correo electrónico.'
    } else if (!REGEX_CORREO.test(form.correo.trim())) {
      e.correo = 'El correo no tiene un formato válido (ejemplo: nombre@correo.com).'
    }

    if (!form.genero) e.genero = 'Selecciona tu género.'
    if (form.genero === 'Otros' && !form.genero_otro.trim()) {
      e.genero_otro = 'Especifica tu género.'
    }

    if (!form.capitan_nombre.trim()) e.capitan_nombre = 'Escribe el nombre del capitán.'

    const errorCapitan = validarTelefono(
      form.capitan_celular,
      'Escribe el celular del capitán.'
    )
    if (errorCapitan) e.capitan_celular = errorCapitan

    if (!aceptaPrivacidad) {
      e.privacidad = 'Debes aceptar el aviso de privacidad para continuar.'
    }

    return e
  }

  const handleSubmit = async (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault()

    /* Segunda barrera contra el doble envío (la primera es `disabled` en el
       botón): cubre un submit disparado con Enter mientras el insert vuela. */
    if (enviando) return

    const nuevosErrores = validar()
    setErrores(nuevosErrores)
    setErrorEnvio(false)

    if (Object.keys(nuevosErrores).length > 0) {
      /* Foco al primer campo inválido siguiendo el orden visual, no el orden de
         las claves del objeto. Los radios y el checkbox son `sr-only`: el id
         apunta al input real, que es quien recibe el foco. */
      const primerCampo = ORDEN_CAMPOS.find((campo) => nuevosErrores[campo])
      if (primerCampo) {
        const elemento = document.getElementById(primerCampo)
        if (elemento) {
          elemento.focus({ preventScroll: true })
          elemento.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }
      return
    }

    /* Escolaridad y Género se guardan resueltos: si la persona eligió "Otros",
       el valor final es el texto que especificó, no la etiqueta genérica. */
    const escolaridadFinal =
      form.escolaridad === 'Otros' ? form.escolaridad_otro.trim() : form.escolaridad
    const generoFinal =
      form.genero === 'Otros' ? form.genero_otro.trim() : form.genero

    /* Nombres de propiedad ya alineados con las columnas de la base de datos.
       Los celulares van normalizados a 10 dígitos, sin separadores. */
    const payload: InscripcionPayload = {
      equipo: form.equipo.trim(),
      gamertag: form.gamertag.trim(),
      nombre: form.nombre.trim(),
      fecha_nacimiento: form.fecha_nacimiento,
      celular: soloDigitos(form.celular),
      escolaridad: escolaridadFinal,
      municipio: form.municipio.trim(),
      localidad: form.localidad.trim(),
      correo: form.correo.trim(),
      genero: generoFinal,
      capitan_nombre: form.capitan_nombre.trim(),
      capitan_celular: soloDigitos(form.capitan_celular)
    }

    setEnviando(true)
    try {
      /* Sin credenciales de Supabase el cliente viene en `null` (el build salió
         sin las VITE_*). Es un fallo de envío más: mismo banner genérico, sin
         texto especial, y la página sigue en pie. */
      const supabase = obtenerSupabase()
      if (!supabase) {
        setErrorEnvio(true)
        return
      }

      /* Sin `.select()` ni `.single()`: la tabla tiene RLS con permiso de
         INSERT pero no de SELECT para anónimos, así que pedir las filas
         insertadas haría fallar el envío por permisos. En supabase-js v2 el
         insert no devuelve filas por defecto.
         El `abortSignal` corta a los 15 s: sin él, un backend colgado deja el
         botón en "Enviando…" hasta el timeout del navegador. El aborto vuelve
         como `error` en la respuesta, así que cae en la misma rama de abajo. */
      const { error } = await supabase
        .from('inscripciones')
        .insert(payload)
        .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_ENVIO_MS))

      if (error) {
        setErrorEnvio(true)
        return
      }

      setEnviado(true)
    } catch {
      /* Fallo de red o de configuración. No se captura el error ni se registra
         en consola: el payload son datos personales y el mensaje al usuario es
         genérico a propósito. */
      setErrorEnvio(true)
    } finally {
      /* En `finally` para que un fallo de red no deje el botón trabado en
         "Enviando…" para siempre. */
      setEnviando(false)
    }
  }

  const reiniciar = () => {
    setForm(FORM_VACIO)
    setErrores({})
    setAceptaPrivacidad(false)
    setErrorEnvio(false)
    setEnviado(false)
  }

  const hayErrores = Object.keys(errores).length > 0

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
              LQC Split Primavera 2026
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
              Formulario de registro por jugador
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
                  ¡Registro recibido!
                </h2>
                <p className="text-gray-300 mb-10 max-w-lg mx-auto leading-relaxed">
                  Recibimos tu registro. Te contactaremos para confirmar tu inscripción y
                  el pago.
                </p>

                {/* Comunidad. `after:hidden` desactiva la barra de gradiente que la
                    regla base `a::after` de index.css dibuja en hover: acá el enlace
                    ya es una pastilla con borde y quedaría un subrayado de más. */}
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
                  Registrar otro jugador
                </button>
              </div>
            ) : (
              /* ---------- Formulario ---------- */
              <form onSubmit={handleSubmit} noValidate className="space-y-12">
                {/* Datos del jugador */}
                <div>
                  <TituloSeccion>Datos del Jugador</TituloSeccion>
                  <div className={CLASE_TARJETA}>
                    <div className="grid md:grid-cols-2 gap-6">
                      <CampoTexto
                        id="equipo"
                        label="Equipo"
                        icono={Users}
                        valor={form.equipo}
                        onChange={(v) => setCampo('equipo', v)}
                        error={errores.equipo}
                        placeholder="Nombre de tu equipo"
                        claseContenedor="md:col-span-2"
                      />
                      <div>
                        <CampoTexto
                          id="gamertag"
                          /* El label es «Riot ID» (lo que valida REGEX_RIOT_ID), pero el id,
                             la clave del estado y la columna de la base se llaman `gamertag`:
                             renombrarlos rompe el INSERT. */
                          label="Riot ID"
                          icono={Gamepad2}
                          valor={form.gamertag}
                          onChange={(v) => setCampo('gamertag', v)}
                          error={errores.gamertag}
                          placeholder="Jugador#MX1"
                          autoComplete="nickname"
                          describedById="gamertag-ayuda"
                        />
                        {/* Ayuda de formato del Riot ID, asociada al input por
                            aria-describedby (describedById). En su propio contenedor para
                            ocupar una sola celda del grid, no una columna extra. */}
                        <p id="gamertag-ayuda" className="mt-2 text-sm text-gray-400">
                          Es tu Riot ID completo: nombre, luego #, luego tag (por ejemplo,
                          Jugador#MX1). Lo encuentras en el cliente de League, en tu perfil
                          de Riot; el tag es lo que va después del #.
                        </p>
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
                        autoComplete="bday"
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
                    </div>
                  </div>
                </div>

                {/* Perfil y ubicación */}
                <div>
                  <TituloSeccion>Perfil y Ubicación</TituloSeccion>
                  <div className={`${CLASE_TARJETA} space-y-8`}>
                    {/* Escolaridad */}
                    <fieldset
                      role="radiogroup"
                      aria-labelledby="escolaridad-label"
                      aria-required="true"
                      aria-invalid={errores.escolaridad ? true : undefined}
                      aria-describedby={errores.escolaridad ? 'escolaridad-error' : undefined}
                      className="border-0 p-0 m-0"
                    >
                      <legend id="escolaridad-label" className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                        <GraduationCap className="w-4 h-4 text-blue-400" />
                        Escolaridad <span className="text-lqc-accent" aria-hidden="true">*</span>
                      </legend>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {OPCIONES_ESCOLARIDAD.map((opcion, indice) => (
                          <OpcionPill
                            key={opcion}
                            id={indice === 0 ? 'escolaridad' : undefined}
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
                      {form.escolaridad === 'Otros' && (
                        <div className="mt-4">
                          <CampoTexto
                            id="escolaridad_otro"
                            label="Especifica tu escolaridad"
                            icono={GraduationCap}
                            valor={form.escolaridad_otro}
                            onChange={(v) => setCampo('escolaridad_otro', v)}
                            error={errores.escolaridad_otro}
                            placeholder="¿Cuál?"
                          />
                        </div>
                      )}
                    </fieldset>

                    <div className="grid md:grid-cols-2 gap-6">
                      <CampoTexto
                        id="municipio"
                        label="Municipio"
                        icono={MapPin}
                        valor={form.municipio}
                        onChange={(v) => setCampo('municipio', v)}
                        error={errores.municipio}
                        placeholder="Municipio donde vives"
                        autoComplete="address-level2"
                      />
                      <CampoTexto
                        id="localidad"
                        label="Localidad"
                        icono={Map}
                        valor={form.localidad}
                        onChange={(v) => setCampo('localidad', v)}
                        error={errores.localidad}
                        placeholder="Colonia o localidad"
                        autoComplete="address-level3"
                      />
                      <CampoTexto
                        id="correo"
                        label="Correo electrónico"
                        icono={Mail}
                        tipo="email"
                        valor={form.correo}
                        onChange={(v) => setCampo('correo', v)}
                        error={errores.correo}
                        placeholder="tu@correo.com"
                        autoComplete="email"
                        claseContenedor="md:col-span-2"
                      />
                    </div>

                    {/* Género */}
                    <fieldset
                      role="radiogroup"
                      aria-labelledby="genero-label"
                      aria-required="true"
                      aria-invalid={errores.genero ? true : undefined}
                      aria-describedby={errores.genero ? 'genero-error' : undefined}
                      className="border-0 p-0 m-0"
                    >
                      <legend id="genero-label" className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                        <UserCircle className="w-4 h-4 text-blue-400" />
                        Género <span className="text-lqc-accent" aria-hidden="true">*</span>
                      </legend>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {OPCIONES_GENERO.map((opcion, indice) => (
                          <OpcionPill
                            key={opcion}
                            id={indice === 0 ? 'genero' : undefined}
                            name="genero"
                            valor={opcion}
                            seleccionado={form.genero === opcion}
                            onSelect={(v) => setOpcion('genero', v)}
                            error={Boolean(errores.genero)}
                          />
                        ))}
                      </div>
                      {errores.genero && <MensajeError id="genero-error" texto={errores.genero} />}
                      {form.genero === 'Otros' && (
                        <div className="mt-4">
                          <CampoTexto
                            id="genero_otro"
                            label="Especifica tu género"
                            icono={UserCircle}
                            valor={form.genero_otro}
                            onChange={(v) => setCampo('genero_otro', v)}
                            error={errores.genero_otro}
                            placeholder="¿Cuál?"
                          />
                        </div>
                      )}
                    </fieldset>
                  </div>
                </div>

                {/* Capitán */}
                <div>
                  <TituloSeccion>Capitán del Equipo</TituloSeccion>
                  <div className={CLASE_TARJETA}>
                    <div className="grid md:grid-cols-2 gap-6">
                      <CampoTexto
                        id="capitan_nombre"
                        label="Nombre del Capitán"
                        icono={User}
                        valor={form.capitan_nombre}
                        onChange={(v) => setCampo('capitan_nombre', v)}
                        error={errores.capitan_nombre}
                        placeholder="Nombre completo del capitán"
                      />
                      <CampoTexto
                        id="capitan_celular"
                        label="Celular del Capitán"
                        icono={Phone}
                        tipo="tel"
                        valor={form.capitan_celular}
                        onChange={(v) => setCampo('capitan_celular', v)}
                        error={errores.capitan_celular}
                        placeholder="10 dígitos"
                      />
                    </div>
                  </div>
                </div>

                {/* Pago de inscripción (informativo) */}
                <div>
                  <TituloSeccion>Pago de Inscripción</TituloSeccion>
                  <div className="bg-gradient-to-br from-blue-950/30 to-lqc-900/20 backdrop-blur-sm border border-blue-800/30 rounded-2xl p-6 md:p-8 shadow-lqc">
                    {/* Encabezado: de qué cuenta se trata + cuánto se transfiere.
                        El monto y la CLABE son los dos datos que se necesitan para
                        completar la transferencia, así que van con jerarquía propia. */}
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

                    {/* La aclaración va fuera de la caja del monto: si creciera dentro,
                        la rompería en móvil. Es el punto donde más fácil se malinterpreta
                        la ficha, porque el formulario es por jugador y el pago no. */}
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

                {/* Aviso de privacidad */}
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
                          logística y comunicación del evento LQC Split Primavera 2026.
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
                          Tus datos <span className="text-white font-medium">no se comparten con
                          terceros</span> sin tu consentimiento.
                        </span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-lqc-accent mt-2.5 shrink-0" />
                        <span className="text-gray-300">
                          Como titular puedes ejercer tus{' '}
                          <span className="text-white font-medium">
                            derechos ARCO (acceso, rectificación, cancelación u oposición)
                          </span>{' '}
                          sobre el tratamiento de tus datos. Para hacerlo, escribe a{' '}
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

                    {/* Consentimiento */}
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
                            if (e.target.checked) {
                              setErrores((prev) => {
                                if (!prev.privacidad) return prev
                                const siguiente = { ...prev }
                                delete siguiente.privacidad
                                return siguiente
                              })
                            }
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
                          Acepto el tratamiento de mis datos conforme al aviso de privacidad.{' '}
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
                        No pudimos enviar el registro: falta información o hay datos con
                        formato incorrecto. Revisa los campos que tienen un mensaje de
                        error debajo.
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
                        nuevo en unos minutos. Tus datos siguen escritos en el formulario.
                      </p>
                    </div>
                  )}

                  {/* `disabled` + clases de estado en vez de un `bg-*`: la regla base
                      de index.css le pone un gradiente a todo <button> y las utilidades
                      de Tailwind solo pisan `background-color`, no `background-image`.
                      Con opacidad y `cursor-not-allowed` el estado se lee sin pelearse
                      con el gradiente; las clases de hover se quitan mientras envía. */}
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
                        Enviar Registro
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
