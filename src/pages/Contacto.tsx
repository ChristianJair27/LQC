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
      description: "Comunidad activa",
      action: "Unirse al servidor"
    },
    {
      icon: Globe,
      title: "Redes Sociales",
      value: "@lqroc",
      description: "Twitter y Twitch",
      action: "Seguir en redes"
    }
  ]

  const faqs = [
    {
      question: "¿Cómo puedo inscribir a mi equipo?",
      answer: "Las inscripciones se abren al inicio de cada temporada a través de Battlefy. Consulta la página principal para las fechas exactas."
    },
    {
      question: "¿Cuáles son los requisitos para participar?",
      answer: "Debes ser mayor de 16 años, residir en Querétaro o zonas aledañas, y contar con un equipo completo de 5 jugadores más suplentes."
    },
    {
      question: "¿Hay algún costo de inscripción?",
      answer: "El torneo es completamente gratuito para los equipos participantes. Los premios son patrocinados por nuestros aliados."
    },
    {
      question: "¿Dónde se transmiten los partidos?",
      answer: "Todos los partidos oficiales se transmiten en Twitch.tv/lqroc con comentaristas profesionales."
    }
  ]

  const supportHours = [
    { day: "Lunes a Viernes", hours: "10:00 - 18:00", type: "General" },
    { day: "Sábados", hours: "12:00 - 16:00", type: "Torneos" },
    { day: "Domingos", hours: "14:00 - 20:00", type: "Transmisión" }
  ]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Simulación de envío
    setTimeout(() => {
      setIsSubmitted(true)
      setFormData({ name: '', email: '', subject: '', message: '' })
    }, 1000)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Fondo minimalista */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-950 to-black" />
        <div className="absolute inset-0 opacity-5">
          <div className="h-full w-full bg-[linear-gradient(90deg,transparent_50%,rgba(255,255,255,0.02)_50%)] bg-[size:30px_30px]" />
        </div>
        <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-blue-900/20 to-transparent" />
        
        {/* Copa flotante de fondo (la que ya tenías) */}
        <img
          src="/assets/LOGO COPA.png"
          alt="LQC Trophy Logo"
          className="
            absolute 
            -left-[75%] sm:-left-[55%] md:-left-[50%] lg:-left-[45%] xl:-left-[29%]
            top-1/2 -translate-y-1/2
            w-[90%] sm:w-[80%] md:w-[70%] lg:w-[60%] xl:w-[55%]
            max-w-none opacity-12
            animate-float-slow pointer-events-none
          "
        />
      </div>

      {/* Contenido principal */}
      <div className="relative z-10">
        {/* Hero Section */}
        <div className="border-b border-gray-900 py-24 md:py-32">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-2 h-16 bg-gradient-to-b from-blue-600 to-blue-400"></div>
                <div>
                  <h1 className="text-5xl md:text-6xl font-light tracking-tight text-white mb-3">
                    Contacto
                  </h1>
                  <div className="flex items-center gap-3">
                    <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-white">
                      LQC
                    </h1>
                    <span className="px-3 py-1 text-sm bg-blue-900/30 text-blue-400 border border-blue-800/50 rounded-full">
                      Comunícate con nosotros
                    </span>
                  </div>
                </div>
              </div>
              
              <p className="text-lg text-gray-400 font-light max-w-2xl leading-relaxed">
                Estamos aquí para responder tus preguntas, escuchar tus sugerencias 
                y ayudarte a ser parte de la comunidad competitiva de Querétaro.
              </p>
            </div>
          </div>
        </div>

        {/* Métodos de contacto */}
        <div className="border-b border-gray-900 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center gap-3 mb-12">
                <div className="w-1 h-10 bg-gradient-to-b from-blue-600 to-blue-400"></div>
                <h2 className="text-2xl font-light text-white">Métodos de Contacto</h2>
              </div>
              
              <div className="grid md:grid-cols-3 gap-6">
                {contactMethods.map((method, index) => (
                  <div key={index} className="space-y-4 p-6 border border-gray-900 rounded-lg hover:border-gray-700 transition-all duration-300">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-900/30 to-blue-800/20 border border-blue-800/30 flex items-center justify-center">
                        <method.icon className="w-6 h-6 text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-medium text-white">{method.title}</h3>
                        <p className="text-sm text-gray-500">{method.description}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="text-lg text-white font-light">{method.value}</div>
                      <button className="text-sm text-gray-500 hover:text-white transition-colors flex items-center gap-1">
                        {method.action}
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Formulario de contacto */}
        <div className="border-b border-gray-900 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="grid md:grid-cols-2 gap-12">
                <div className="space-y-8">
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-1 h-10 bg-gradient-to-b from-blue-600 to-blue-400"></div>
                      <h2 className="text-2xl font-light text-white">Envía un Mensaje</h2>
                    </div>
                    <p className="text-gray-400 leading-relaxed">
                      Completa el formulario y nuestro equipo se pondrá en contacto 
                      contigo lo antes posible. Preferiblemente en horarios de atención.
                    </p>
                  </div>
                  
                  {/* Horarios de atención */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-blue-400" />
                      <h3 className="text-lg font-medium text-white">Horarios de Atención</h3>
                    </div>
                    
                    <div className="space-y-3">
                      {supportHours.map((schedule, index) => (
                        <div key={index} className="flex items-center justify-between pb-3 border-b border-gray-900 last:border-0 last:pb-0">
                          <div>
                            <div className="text-white">{schedule.day}</div>
                            <div className="text-sm text-gray-500">{schedule.type}</div>
                          </div>
                          <div className="text-gray-400">{schedule.hours}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div>
                  {isSubmitted ? (
                    <div className="space-y-6 text-center py-12">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-r from-green-900/30 to-green-800/20 border border-green-800/30 flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-10 h-10 text-green-400" />
                      </div>
                      <h3 className="text-xl font-light text-white">Mensaje Enviado</h3>
                      <p className="text-gray-400">
                        Hemos recibido tu mensaje. Te contactaremos en las próximas 24-48 horas.
                      </p>
                      <button 
                        onClick={() => setIsSubmitted(false)}
                        className="px-6 py-3 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700 transition-all duration-300 text-sm"
                      >
                        Enviar otro mensaje
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Nombre</label>
                          <div className="relative">
                            <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                              <User className="w-5 h-5 text-gray-600" />
                            </div>
                            <input
                              type="text"
                              name="name"
                              value={formData.name}
                              onChange={handleChange}
                              required
                              className="w-full pl-10 pr-4 py-3 bg-gray-950 border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:border-blue-600 focus:outline-none transition-colors"
                              placeholder="Tu nombre completo"
                            />
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Correo Electrónico</label>
                          <div className="relative">
                            <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                              <Mail className="w-5 h-5 text-gray-600" />
                            </div>
                            <input
                              type="email"
                              name="email"
                              value={formData.email}
                              onChange={handleChange}
                              required
                              className="w-full pl-10 pr-4 py-3 bg-gray-950 border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:border-blue-600 focus:outline-none transition-colors"
                              placeholder="correo@ejemplo.com"
                            />
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Asunto</label>
                          <select
                            name="subject"
                            value={formData.subject}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-lg text-white focus:border-blue-600 focus:outline-none transition-colors"
                          >
                            <option value="">Seleccionar asunto</option>
                            <option value="inscripcion">Inscripción de equipo</option>
                            <option value="patrocinio">Patrocinio y colaboraciones</option>
                            <option value="prensa">Prensa y medios</option>
                            <option value="sugerencia">Sugerencias y feedback</option>
                            <option value="tecnico">Problemas técnicos</option>
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
                            rows={5}
                            className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:border-blue-600 focus:outline-none transition-colors resize-none"
                            placeholder="Describe tu consulta o propuesta..."
                          />
                        </div>
                      </div>
                      
                      <button
                        type="submit"
                        className="w-full px-6 py-3 bg-gradient-to-r from-blue-900/30 to-blue-800/20 border border-blue-800/30 text-white hover:border-blue-600 transition-all duration-300 text-sm font-medium flex items-center justify-center gap-2"
                      >
                        <Send className="w-4 h-4" />
                        Enviar Mensaje
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Preguntas frecuentes */}
        <div className="border-b border-gray-900 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center gap-3 mb-12">
                <div className="w-1 h-10 bg-gradient-to-b from-blue-600 to-blue-400"></div>
                <h2 className="text-2xl font-light text-white">Preguntas Frecuentes</h2>
              </div>
              
              <div className="space-y-6">
                {faqs.map((faq, index) => (
                  <div key={index} className="pb-6 border-b border-gray-900 last:border-0 last:pb-0">
                    <h3 className="text-lg font-medium text-white mb-3">{faq.question}</h3>
                    <p className="text-gray-400">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Ubicación */}
        <div className="py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="grid md:grid-cols-2 gap-12">
                <div className="space-y-8">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-6 h-6 text-blue-400" />
                    <div>
                      <h2 className="text-2xl font-light text-white">Ubicación</h2>
                      <p className="text-gray-400">Querétaro, México</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <p className="text-gray-400 leading-relaxed">
                      El LQC opera desde la ciudad de Querétaro, organizando torneos 
                      tanto en línea como en eventos presenciales en diferentes sedes 
                      de la ciudad.
                    </p>
                    
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                        <div className="text-white">Eventos presenciales en diferentes sedes</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                        <div className="text-white">Transmisiones desde estudio propio</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                        <div className="text-white">Cobertura en toda el área metropolitana</div>
                      </div>
                    </div>
                  </div>
                  
                  <button className="px-6 py-3 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700 transition-all duration-300 text-sm">
                    Ver ubicaciones específicas
                  </button>
                </div>
                
                <div className="relative">
                  <div className="aspect-[4/3] bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-800 rounded-lg overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-r from-blue-900/30 to-blue-800/20 border border-blue-800/30 flex items-center justify-center mx-auto mb-4">
                          <MapPin className="w-10 h-10 text-blue-400" />
                        </div>
                        <div className="text-gray-400">Mapa de ubicación</div>
                        <div className="text-sm text-gray-500 mt-2">Querétaro, QRO</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </div>
  )
}