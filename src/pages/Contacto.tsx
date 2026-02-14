import { useState } from 'react'
import { 
  Mail, MapPin, Send, CheckCircle, 
  MessageSquare, User, Globe, Clock, ChevronRight 
} from 'lucide-react'
import Footer from '../components/layout/Footer'

export default function Contacto() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  })
  const [isSubmitted, setIsSubmitted] = useState(false)

  const contactMethods = [
    {
      icon: Mail,
      title: "Correo Electrónico",
      value: "contacto@revolution505.com",
      description: "Respuesta en 24-48 horas",
      action: "Enviar correo"
    },
    {
      icon: MessageSquare,
      title: "Discord",
      value: "discord.gg/lqc",
      description: "Comunidad activa 24/7",
      action: "Unirse al servidor"
    },
    {
      icon: Globe,
      title: "Redes Sociales",
      value: "@lqroc",
      description: "Twitter / Twitch",
      action: "Seguir y chatear"
    }
  ]

  const faqs = [
    {
      question: "¿Cómo puedo inscribir a mi equipo?",
      answer: "Las inscripciones se abren al inicio de cada temporada directamente en Battlefy. Revisa la página principal para ver las fechas actuales y el botón de inscripción."
    },
    {
      question: "¿Cuáles son los requisitos para participar?",
      answer: "Ser mayor de 16 años, residir en Querétaro o zonas cercanas, y formar un equipo completo (5 jugadores + suplentes opcionales)."
    },
    {
      question: "¿Hay algún costo de inscripción?",
      answer: "El torneo es 100% gratuito para todos los equipos participantes. Los premios son cubiertos por nuestros patrocinadores."
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Aquí iría la lógica real de envío (Formspree, EmailJS, API, etc.)
    setTimeout(() => {
      setIsSubmitted(true)
      setFormData({ name: '', email: '', subject: '', message: '' })
    }, 1200)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

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
            <h1 className="text-5xl md:text-7xl font-extralight tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-blue-300 to-purple-400 mb-6">
              Contacto LQC
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Estamos aquí para resolver tus dudas, recibir propuestas y ayudarte a formar parte de la comunidad competitiva de Querétaro.
            </p>
          </div>
        </section>

        {/* Métodos de contacto */}
        <section className="py-20">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="grid md:grid-cols-3 gap-8">
              {contactMethods.map((method, index) => (
                <div 
                  key={index}
                  className="bg-black/30 backdrop-blur-sm p-8 rounded-2xl border border-white/5 hover:border-blue-500/30 hover:shadow-blue-900/20 transition-all duration-300 group"
                >
                  <div className="flex items-center gap-5 mb-6">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-900/40 to-blue-800/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <method.icon className="w-7 h-7 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-medium">{method.title}</h3>
                      <p className="text-sm text-gray-400">{method.description}</p>
                    </div>
                  </div>
                  <div className="text-2xl font-light mb-4">{method.value}</div>
                  <button className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-2 text-sm font-medium">
                    {method.action}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Formulario + Horarios */}
        <section className="py-20 bg-black/20">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="grid lg:grid-cols-2 gap-16">
              {/* Formulario */}
              <div className="space-y-10">
                <div className="flex items-center gap-4">
                  <div className="w-1.5 h-12 bg-gradient-to-t from-blue-600 to-blue-400 rounded-full" />
                  <h2 className="text-3xl font-light">Envía un Mensaje</h2>
                </div>

                <p className="text-gray-300 leading-relaxed">
                  Completa el formulario y nuestro equipo te responderá lo antes posible (normalmente en 24-48 horas).
                </p>

                {isSubmitted ? (
                  <div className="bg-black/40 backdrop-blur-md border border-green-800/30 rounded-2xl p-12 text-center">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-r from-green-900/40 to-green-800/30 flex items-center justify-center mx-auto mb-6">
                      <CheckCircle className="w-10 h-10 text-green-400" />
                    </div>
                    <h3 className="text-2xl font-light mb-4">¡Mensaje Enviado!</h3>
                    <p className="text-gray-300 mb-8">
                      Gracias por contactarnos. Te responderemos pronto.
                    </p>
                    <button 
                      onClick={() => setIsSubmitted(false)}
                      className="px-8 py-4 bg-black/50 border border-green-800/40 text-gray-200 rounded-xl hover:bg-green-900/30 transition-all duration-300"
                    >
                      Enviar otro mensaje
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Nombre</label>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                          <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                            className="w-full pl-12 pr-4 py-4 bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
                            placeholder="Tu nombre completo"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Correo</label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                          <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            className="w-full pl-12 pr-4 py-4 bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
                            placeholder="tu@correo.com"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Asunto</label>
                      <select
                        name="subject"
                        value={formData.subject}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-4 bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
                      >
                        <option value="">Selecciona un asunto</option>
                        <option value="inscripcion">Inscripción de equipo</option>
                        <option value="patrocinio">Patrocinio o colaboración</option>
                        <option value="prensa">Prensa y medios</option>
                        <option value="sugerencia">Sugerencias / Feedback</option>
                        <option value="tecnico">Problema técnico</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Mensaje</label>
                      <textarea
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        required
                        rows={6}
                        className="w-full px-4 py-4 bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all resize-none"
                        placeholder="Cuéntanos tu consulta, propuesta o duda..."
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-4 bg-gradient-to-r from-blue-700 to-purple-700 hover:from-blue-600 hover:to-purple-600 rounded-xl font-medium transition-all duration-300 shadow-lg shadow-blue-900/30 flex items-center justify-center gap-3"
                    >
                      <Send className="w-5 h-5" />
                      Enviar Mensaje
                    </button>
                  </form>
                )}
              </div>

              {/* Horarios */}
              <div className="space-y-10">
                <div className="flex items-center gap-4">
                  <div className="w-1.5 h-12 bg-gradient-to-t from-blue-600 to-blue-400 rounded-full" />
                  <h2 className="text-3xl font-light">Horarios de Atención</h2>
                </div>

                <div className="bg-black/30 backdrop-blur-sm p-8 rounded-2xl border border-white/5 space-y-6">
                  {supportHours.map((sch, i) => (
                    <div key={i} className="flex justify-between items-center py-4 border-b border-white/5 last:border-0">
                      <div>
                        <div className="font-medium">{sch.day}</div>
                        <div className="text-sm text-gray-400">{sch.type}</div>
                      </div>
                      <div className="text-blue-300 font-medium">{sch.hours}</div>
                    </div>
                  ))}
                </div>

                <p className="text-gray-400 text-sm">
                  Fuera de horario puedes escribirnos por Discord o correo — te responderemos al siguiente día hábil.
                </p>
              </div>
            </div>
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