---
name: registro-espanol-tuteo
description: Los textos de UI del sitio van en español de México con tuteo (Recarga, inténtalo), NO en el voseo de mis instrucciones de agente
metadata:
  type: project
---

Todo el copy visible del sitio usa **español de México con tuteo** ("Revisa los
campos", "inténtalo de nuevo", "Recarga la página"), no el voseo rioplatense.

**Why:** mis propias instrucciones de agente (y AGENTS.md) me hablan en "vos"
("leélo", "verificá", "agregá"), lo que empuja a escribir copy en voseo. Pero el
contenido real de las páginas — el banner de error de `/registro` es la
referencia canónica — está en tuteo. Mezclar registros produce deriva de tono
entre páginas.

**How to apply:** al escribir cualquier texto de UI nuevo (fallbacks, botones,
mensajes de error, CTAs), usar imperativo de "tú" ("Recarga", "Vuelve",
"Escribe"), nunca de "vos" ("Recargá", "Volvé", "Escribí"). El voseo queda solo
para hablar conmigo, no para el producto. El fallback del `ErrorBoundary`
(`src/components/ErrorBoundary.tsx`) ya sigue esta regla.

Ver también [[canon-formularios]], [[contraste-y-reglas-base]].
