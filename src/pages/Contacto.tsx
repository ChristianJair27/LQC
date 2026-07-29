import {
  Mail, MapPin, MessageSquare, Facebook, Twitch, ChevronRight
} from 'lucide-react'

/* Canales de contacto. Cada uno tiene destino REAL: la tarjeta entera es el enlace, así que
   no hay ningún control que parezca accionable y no haga nada. Antes esta página ofrecía
   además un formulario que simulaba enviar —un setTimeout y una pantalla de "¡Mensaje
   Enviado!"— sin transmitir nada a ningún lado; se quitó, porque una consulta que el usuario
   cree enviada y nadie recibe es peor que no tener formulario.
   Las URLs se copian de Footer.tsx, que es donde viven. `externo` marca las que salen del
   sitio y necesitan target/rel; el mailto no abre pestaña. */
const canales = [
  {
    icon: Mail,
    titulo: "Correo Electrónico",
    descripcion: "Respuesta en 24-48 horas",
    valor: "contactolqc@revolution505.com",
    accion: "Enviar correo",
    href: "mailto:contactolqc@revolution505.com",
    externo: false,
    /* El `aria` empieza SIEMPRE con el título visible: como pisa el nombre que saldría del
       contenido, si no lo incluyera incumpliría WCAG 2.5.3 (Label in Name) y quien navega
       por voz no podría activar la tarjeta diciendo lo que lee en pantalla. */
    aria: "Correo electrónico: escribir a contactolqc@revolution505.com"
  },
  {
    icon: MessageSquare,
    titulo: "Discord",
    descripcion: "Comunidad activa 24/7",
    valor: "discord.gg/eS6zkvfkp",
    accion: "Unirse al servidor",
    href: "https://discord.gg/eS6zkvfkp",
    externo: true,
    aria: "Discord: unirse al servidor de LQC (abre en pestaña nueva)"
  },
  {
    icon: Facebook,
    titulo: "Facebook",
    descripcion: "Página oficial de la liga",
    valor: "facebook.com/lolqrochampionship",
    accion: "Seguir la página",
    href: "https://www.facebook.com/lolqrochampionship/",
    externo: true,
    aria: "Facebook: ver la página de LQC (abre en pestaña nueva)"
  },
  {
    icon: Twitch,
    titulo: "Twitch",
    descripcion: "Transmisiones en vivo",
    valor: "twitch.tv/lqroc",
    accion: "Ver el canal",
    href: "https://twitch.tv/lqroc",
    externo: true,
    aria: "Twitch: ver el canal de LQC (abre en pestaña nueva)"
  }
]

export default function Contacto() {
  /* OJO: estas respuestas describen el modelo de registro, así que envejecen con él.
     Los números del roster (5 a 7, 5 titulares) y la lista de campos que se piden son
     los de `src/pages/Registro.tsx` —MIN_JUGADORES, MAX_JUGADORES, TITULARES y los
     campos del payload— y los hace cumplir la RPC `registrar_equipo`. Si cambian ahí,
     hay que tocarlos acá y en la tarjeta CTA de Home.tsx: son tres copias en prosa que
     nada sincroniza. Nada de fechas, cupos ni premios: no están confirmados. */
  const faqs = [
    {
      question: "¿Cómo puedo inscribir a mi equipo?",
      answer: "Lo hace el capitán, desde la sección Registro del menú: en un solo envío registra al equipo completo con su roster de 5 a 7 jugadores —los 5 primeros quedan como titulares y del 6º en adelante como suplentes—. De cada jugador se piden Riot ID, nombre, fecha de nacimiento, celular, correo, municipio, escolaridad y género; del capitán, su Riot ID y su celular. Conviene tenerlo todo a mano antes de empezar."
    },
    {
      question: "¿Cuáles son los requisitos para participar?",
      answer: "Tener al menos 16 años cumplidos, residir en Querétaro o zonas cercanas, y formar un equipo de 5 a 7 jugadores: 5 titulares y hasta 2 suplentes."
    },
    {
      question: "¿Hay algún costo de inscripción?",
      answer: "Sí: $500 MXN por equipo, no por jugador. Es un solo pago que realiza el capitán por transferencia, con el nombre del equipo como concepto."
    },
    {
      question: "¿Dónde se transmiten los partidos?",
      answer: "Todos los encuentros oficiales se transmiten en vivo por Twitch.tv/lqroc con comentaristas y producción profesional."
    }
  ]

  const supportHours = [
    { day: "Lunes a Viernes", hours: "10:00 - 18:00", type: "Consultas generales" },
    { day: "Sábados", hours: "12:00 - 16:00", type: "Apoyo en torneos" },
    { day: "Domingos", hours: "14:00 - 20:00", type: "Soporte en transmisiones" }
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
          alt="LQC Trophy Logo"
          className="
            absolute 
            -left-[60%] sm:-left-[40%] md:-left-[30%] lg:-left-[20%] xl:-left-[10%]
            top-[15%] sm:top-[10%]
            w-[110%] sm:w-[90%] md:w-[80%] lg:w-[70%] xl:w-[60%]
            max-w-none opacity-10
            animate-float-slow pointer-events-none blur-[1px]
          "
        />
      </div>

      <div className="relative z-10">
        {/* Hero */}
        <section className="py-32 md:py-40">
          <div className="container mx-auto px-6 max-w-5xl text-center">
            <h1 className="text-5xl md:text-7xl font-extralight tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-blue-300 to-lqc-accent mb-6">
              Contacto LQC
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Estamos aquí para resolver tus dudas, recibir propuestas y ayudarte a formar parte de la comunidad competitiva de Querétaro.
            </p>
          </div>
        </section>

        {/* Canales de contacto: el camino principal de la página desde que no hay
            formulario. La tarjeta ENTERA es el <a>, así que el área clickeable es toda la
            caja y la línea de acción es un <span>, no un botón que no hace nada. */}
        <section className="py-20">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-1.5 h-12 bg-gradient-to-t from-blue-600 to-blue-400 rounded-full" />
              <h2 className="text-3xl font-light">Canales oficiales</h2>
            </div>
            <p className="text-gray-300 leading-relaxed mb-12 max-w-3xl">
              Por correo y Discord respondemos normalmente en 24-48 horas. En Facebook y
              Twitch puedes seguir a la liga.
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {canales.map((canal) => (
                <a
                  key={canal.titulo}
                  href={canal.href}
                  {...(canal.externo
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                  aria-label={canal.aria}
                  /* `after:hidden` mata la barra de gradiente que la regla base `a::after`
                     de index.css dibuja al 100% del ancho en hover: acá el enlace es una
                     tarjeta con borde y quedaría un subrayado colgando. `text-white` es
                     obligatorio porque la regla base `a { color: #66a3ff }` pisaría el
                     color de todo el contenido. El anillo de foco va explícito porque, sin
                     la barra de hover, tabulando solo quedaría el outline del navegador
                     sobre fondo negro. Mismo patrón que CLASE_ENLACE_COMUNIDAD en
                     Registro.tsx.
                     `min-w-0` es lo que evita el desborde: un ítem de grid tiene
                     `min-width: auto`, o sea que la pista no encoge por debajo del
                     min-content, y `break-words` (overflow-wrap) NO reduce ese min-content.
                     Sin esto el correo de 29 caracteres estira las 4 columnas más allá del
                     contenedor y aparece scroll horizontal. */
                  className="after:hidden group flex min-w-0 flex-col bg-black/30 backdrop-blur-sm p-8 rounded-2xl border border-white/5 text-white hover:border-blue-500/30 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lqc-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  <div className="flex items-center gap-5 mb-6">
                    {/* `shrink-0`: sin él el círculo cede ancho y se deforma en óvalo
                        cuando el texto de al lado no entra, sobre todo en 4 columnas. */}
                    <div className="w-14 h-14 shrink-0 rounded-full bg-gradient-to-br from-blue-900/40 to-blue-800/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <canal.icon className="w-7 h-7 text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xl font-medium text-white">{canal.titulo}</h3>
                      <p className="text-sm text-gray-400">{canal.descripcion}</p>
                    </div>
                  </div>
                  {/* `break-words`: el correo mide más que la columna y no tiene punto de
                      corte natural, así que sin esto se desborda de la tarjeta. */}
                  <div className="text-lg font-light mb-4 break-words text-gray-200">
                    {canal.valor}
                  </div>
                  <span className="mt-auto text-blue-400 group-hover:text-blue-300 transition-colors flex items-center gap-2 text-sm font-medium">
                    {canal.accion}
                    <ChevronRight className="w-4 h-4 shrink-0" />
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Horarios */}
        <section className="py-20 bg-black/20">
          <div className="container mx-auto px-6 max-w-3xl">
            <div className="flex items-center gap-4 mb-10">
              <div className="w-1.5 h-12 bg-gradient-to-t from-blue-600 to-blue-400 rounded-full" />
              <h2 className="text-3xl font-light">Horarios de Atención</h2>
            </div>

            <div className="bg-black/30 backdrop-blur-sm p-8 rounded-2xl border border-white/5">
              {supportHours.map((sch, i) => (
                <div key={i} className="flex justify-between items-center gap-6 py-4 border-b border-white/5 last:border-0">
                  <div className="min-w-0">
                    <div className="font-medium">{sch.day}</div>
                    <div className="text-sm text-gray-400">{sch.type}</div>
                  </div>
                  <div className="text-blue-300 font-medium shrink-0">{sch.hours}</div>
                </div>
              ))}
            </div>

            <p className="text-gray-400 text-sm mt-6">
              Fuera de horario puedes escribirnos por Discord o correo — te responderemos al siguiente día hábil.
            </p>
          </div>
        </section>

        {/* FAQs */}
        <section className="py-20">
          <div className="container mx-auto px-6 max-w-4xl">
            <div className="flex items-center gap-4 mb-16">
              <div className="w-1.5 h-12 bg-gradient-to-t from-blue-600 to-blue-400 rounded-full" />
              <h2 className="text-3xl font-light">Preguntas Frecuentes</h2>
            </div>

            <div className="space-y-8">
              {faqs.map((faq, index) => (
                <div 
                  key={index}
                  className="bg-black/30 backdrop-blur-sm p-8 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all duration-300"
                >
                  <h3 className="text-xl font-medium mb-4">{faq.question}</h3>
                  <p className="text-gray-300 leading-relaxed">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Ubicación */}
        <section className="py-20 bg-black/20">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="grid md:grid-cols-2 gap-16 items-center">
              <div className="space-y-10">
                <div className="flex items-center gap-4">
                  <MapPin className="w-8 h-8 text-blue-400" />
                  <h2 className="text-3xl font-light">Ubicación</h2>
                </div>

                <p className="text-gray-300 leading-relaxed text-lg">
                  El LQC tiene su base en la hermosa ciudad de Querétaro, México. Organizamos torneos online y eventos presenciales en diferentes sedes de la capital y zona metropolitana.
                </p>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-gray-200">Eventos presenciales en sedes rotativas</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-gray-200">Estudio de transmisión propio</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-gray-200">Cobertura en todo el estado y más allá</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl overflow-hidden shadow-2xl shadow-black/60 bg-black/50 backdrop-blur-md border border-white/5 aspect-[4/3] relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="w-24 h-24 text-blue-500/30 mx-auto mb-4" />
                    <div className="text-2xl font-light">Querétaro, México</div>
                    <div className="text-gray-400 mt-2">Centro de operaciones LQC</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        
      </div>

      <style>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-40px) rotate(2deg); }
        }
        .animate-float-slow {
          animation: float-slow 14s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}