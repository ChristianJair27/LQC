/* Datos del PDF del reglamento, que vive en public/.
   Estas constantes nacieron dentro de Reglamento.tsx, con una nota que decía que se
   quedaban ahí mientras esa página fuera el ÚNICO consumidor del archivo y que se
   mudaran a un módulo compartido en cuanto apareciera un segundo lugar. Apareció: la
   tarjeta del reglamento de /registro también enlaza el PDF y muestra su peso.
   Duplicarlas era la peor opción de las dos: PESO_REGLAMENTO está escrito a mano, así
   que dos copias se desincronizan en silencio en el primer reemplazo del archivo. */

/* El año va en el nombre para poder subir el de 2027 al lado sin romper enlaces ya
   compartidos, lo que obliga a NO borrar el viejo. */
export const RUTA_REGLAMENTO = '/reglamento-lqc-2026.pdf'

/* Nombre con el que se guarda el archivo al descargarlo: legible para una persona, no
   el slug de la URL. `download` solo respeta esto en descargas del mismo origen — es el
   caso, el PDF sale de public/. */
export const NOMBRE_DESCARGA = 'Reglamento LQC 2026.pdf'

/* Peso real del archivo (347 012 bytes ≈ 338,9 KiB), redondeado como lo muestra un
   explorador de archivos. Va a la vista para que quien está con datos móviles decida
   ANTES de bajarlo. Está escrito a mano: si se reemplaza el PDF hay que actualizarlo
   acá, no se calcula solo. Se verifica con `ls -l public/reglamento-lqc-2026.pdf`. */
export const PESO_REGLAMENTO = '339 KB'
