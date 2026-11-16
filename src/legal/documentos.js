/**
 * Términos y condiciones de uso y política de protección de datos
 * personales (LOPDP, RNF-21).
 *
 * Los consume la app móvil por API (GET /legal y GET /legal/:tipo) y se
 * publican como páginas HTML en /legal/*. Al registrarse, el cliente acepta
 * la versión vigente y se guarda en Clientes.legal_version / legal_aceptado_en.
 *
 * Al cambiar cualquier texto, subir VERSION_LEGAL (fecha AAAA-MM-DD; si cambia
 * dos veces el mismo día, agregar .2, .3...): el registro rechaza
 * aceptaciones de una versión anterior.
 *
 * Normas en las que se apoyan (artículos verificados el 16-11-2026):
 * - Constitución de la República del Ecuador, art. 66 num. 19.
 * - Ley Orgánica de Protección de Datos Personales (LOPDP), R.O. Supl. 459,
 *   26-05-2021 (art. 43 reformado en 2026): arts. 4, 7, 8, 9, 10, 12 a 20,
 *   24, 26, 34, 37, 39, 43, 46, 55 a 57. No se designa delegado de protección
 *   de datos: el restaurante no es del sector público ni trata datos sensibles
 *   a gran escala (art. 48). Reglamento General: Decreto
 *   Ejecutivo 904, R.O. 3er Supl. 435, 13-11-2023.
 * - Ley Orgánica de Defensa del Consumidor (LODC), R.O. Supl. 116,
 *   10-07-2000: arts. 4, 9, 41, 42, 43 y 45.
 * - Ley de Comercio Electrónico, Firmas Electrónicas y Mensajes de Datos
 *   (LCE), R.O. Supl. 557, 17-04-2002: arts. 2, 45 a 49.
 *
 * BORRADOR PARA REVISIÓN LEGAL: los datos entre corchetes los completa el
 * responsable del restaurante, y un abogado debe revisar el texto antes de
 * publicar la app en las tiendas.
 */
export const VERSION_LEGAL = '2026-11-16.3';

export const RESPONSABLE = {
  nombre: 'Sabor Politécnico, restaurante universitario',
  razonSocial: '[Razón social o nombre del titular, y número de RUC]',
  direccion: '[Dirección del domicilio legal, Calceta, Manabí]',
  telefono: '[Teléfono de contacto]',
  correo: '[Correo de contacto para protección de datos]'
};

const terminos = {
  tipo: 'terminos',
  titulo: 'Términos y condiciones de uso',
  version: VERSION_LEGAL,
  secciones: [
    {
      titulo: '1. Quiénes somos y qué regulan estos términos',
      parrafos: [
        `La aplicación móvil y los servicios digitales de ${RESPONSABLE.nombre} (en adelante, "la plataforma") los presta ${RESPONSABLE.razonSocial}, con domicilio en ${RESPONSABLE.direccion}, teléfono ${RESPONSABLE.telefono} y correo ${RESPONSABLE.correo}.`,
        'Estos términos regulan la relación entre la plataforma y la persona que crea una cuenta (en adelante, "el cliente") para consultar el menú, hacer pedidos, seguir su estado y pagarlos. Son un contrato de adhesión: en caso de duda, se interpretan a favor del cliente, conforme a la Ley Orgánica de Defensa del Consumidor (LODC).',
        'Nada de lo que dicen limita los derechos que la LODC y las demás leyes del Ecuador reconocen al consumidor; cualquier estipulación en contrario no tiene efecto (LODC, art. 43).'
      ]
    },
    {
      titulo: '2. Aceptación por medios electrónicos',
      parrafos: [
        'Al crear tu cuenta y marcar la casilla de aceptación celebras este contrato por medios electrónicos, con la misma validez que uno firmado en papel (Ley de Comercio Electrónico, Firmas Electrónicas y Mensajes de Datos, LCE, arts. 2 y 45). Guardamos la versión que aceptaste y la fecha.',
        'Para usar la plataforma necesitas un teléfono Android o iPhone con la aplicación instalada, conexión a internet y una cuenta de correo electrónico (LCE, art. 48).',
        'Estos términos y la Política de protección de datos personales están siempre disponibles en castellano, con letra legible, en la aplicación (Perfil) y en la página web de la plataforma (LODC, arts. 41 y 42). Puedes pedir gratis una copia en papel de estos documentos o de los registros de tus pedidos en la caja del restaurante o por correo (LCE, art. 49).'
      ]
    },
    {
      titulo: '3. Tu cuenta',
      parrafos: [
        'Pueden registrarse estudiantes, docentes, personal administrativo y personas externas a la institución. Si eres menor de 18 años, necesitas la autorización de tu madre, padre o representante legal para crear una cuenta y hacer pedidos.',
        'Los datos que ingresas deben ser verdaderos y estar actualizados; puedes corregirlos en Perfil. Con datos falsos o de otra persona no podremos identificarte al entregar tu pedido ni ayudarte a recuperar tu cuenta.',
        'La cuenta es personal. Cuida tu contraseña y no la compartas. Por seguridad, la sesión se cierra sola a los 20 minutos de iniciarla y tras 5 minutos sin uso.',
        'Si activas el ingreso con huella o rostro, podrá entrar a tu cuenta cualquier persona cuya huella o rostro esté registrado en tu teléfono: actívalo solo si eres la única persona registrada.',
        'Si crees que otra persona usa tu cuenta, cambia tu contraseña y avísanos de inmediato.'
      ]
    },
    {
      titulo: '4. Productos, precios y disponibilidad',
      parrafos: [
        'El menú muestra el nombre, la descripción, el precio y la disponibilidad de cada producto. Los precios están en dólares de los Estados Unidos de América y son el valor final que pagas, con los impuestos incluidos (LODC, art. 9).',
        'Las fotografías de los productos son referenciales y pueden no coincidir exactamente con la presentación del plato.',
        'Si tienes alergias, intolerancias o restricciones alimentarias, consulta los ingredientes al personal del restaurante antes de pedir.',
        'La disponibilidad cambia durante el día. El sistema solo acepta un pedido si hay unidades suficientes, y el precio que se cobra es el vigente al momento de enviarlo. Si, ya enviado, hubiera un error en el precio o en la disponibilidad, el restaurante te lo informará antes de prepararlo y podrás elegir entre mantener el pedido o cancelarlo con la devolución total de lo que hayas pagado.'
      ]
    },
    {
      titulo: '5. Pedidos',
      parrafos: [
        'El pedido queda hecho cuando lo envías desde el carrito y la aplicación te muestra su número. Cada pedido admite hasta 50 unidades por producto.',
        'Puedes seguir su estado en Mis pedidos: solicitado, confirmado, en preparación, listo y entregado. Retíralo en el restaurante el mismo día, dentro del horario de atención.',
        'La aplicación no permite cancelar un pedido una vez enviado. Si quieres cambiarlo o cancelarlo, acércate a la caja del restaurante antes de que empiece su preparación; si ya lo pagaste, se te devolverá el valor total.',
        'El restaurante puede cancelar un pedido cuando no pueda prepararlo, por ejemplo porque un producto se agotó o por caso fortuito o fuerza mayor. Te lo informará en la aplicación y, si ya lo pagaste, te devolverá el valor total.'
      ]
    },
    {
      titulo: '6. Pagos',
      parrafos: [
        'Puedes pagar en el restaurante (efectivo, tarjeta o transferencia, según lo que tenga habilitado) o con tarjeta desde la aplicación. Cada pedido tiene un solo pago, por su valor total.',
        'El pago con tarjeta desde la aplicación lo procesa Payphone, una pasarela de pagos, en su propia página segura. Los datos de tu tarjeta se escriben allí: la plataforma no los ve ni los guarda. Payphone aplica a ese pago sus propios términos y su política de privacidad.',
        'El pago solo se registra como aprobado cuando el servidor de la plataforma lo confirma con Payphone. Si cancelas o cierras la página de Payphone antes de terminar, no se hace ningún cobro.',
        'Si se cancela un pedido pagado con tarjeta, la devolución se hace por el mismo medio de pago. El tiempo en que se refleja en tu estado de cuenta depende del banco emisor de tu tarjeta.'
      ]
    },
    {
      titulo: '7. Devoluciones, garantía y reclamos',
      parrafos: [
        'Por su naturaleza, los alimentos preparados no admiten el derecho de devolución de las compras a distancia una vez entregados (LODC, art. 45). Esto no afecta tu derecho a recibir lo que pediste y en buen estado: si recibes un producto distinto, incompleto o en mal estado, avísanos en el momento y se te repondrá o se te devolverá su valor (LODC, art. 4 num. 8).',
        `Puedes presentar quejas o reclamos en la caja del restaurante, en su libro de reclamos (LODC, art. 4 num. 12) o por correo a ${RESPONSABLE.correo}.`,
        'También puedes acudir a la Defensoría del Pueblo y a las demás autoridades competentes en defensa del consumidor.'
      ]
    },
    {
      titulo: '8. Uso adecuado de la plataforma',
      parrafos: [
        'Al usar la plataforma te comprometes a no hacer pedidos con datos falsos o de otra persona, no intentar acceder a cuentas, datos o funciones que no te corresponden, no interferir con su funcionamiento ni con su seguridad, y no usarla para fines ilícitos.',
        'Si incumples estas reglas, podremos suspender o cerrar tu cuenta. Antes te informaremos el motivo por correo, salvo que la urgencia o la seguridad de otras personas lo impidan, y podrás explicar tu caso. La suspensión no afecta los pedidos ya pagados, que se entregarán o se devolverán.'
      ]
    },
    {
      titulo: '9. Funcionamiento del servicio y responsabilidad',
      parrafos: [
        'La plataforma está pensada para funcionar durante el horario de atención del restaurante. Puede tener interrupciones por mantenimiento o por fallas de los servicios de terceros que usa (internet, alojamiento, correo, pasarela de pagos); procuraremos que sean breves.',
        'El restaurante responde por la calidad de los productos y del servicio que presta, en los términos de la LODC. No responde por daños causados por caso fortuito o fuerza mayor, ni por el uso de tu cuenta por terceros cuando se deba a que compartiste tu contraseña o tu teléfono.'
      ]
    },
    {
      titulo: '10. Propiedad intelectual',
      parrafos: [
        'La aplicación, su diseño, el nombre y el logotipo de Sabor Politécnico pertenecen a sus titulares. Puedes usarlos solo para hacer tus pedidos; no está permitido copiarlos, modificarlos ni distribuirlos.',
        'Las fotografías de productos tomadas de terceros se usan conforme a sus licencias; sus autores y licencias se indican en la aplicación, en Perfil → Licencias y créditos.'
      ]
    },
    {
      titulo: '11. Protección de tus datos personales',
      parrafos: [
        'El tratamiento de tus datos personales se rige por la Política de protección de datos personales, que también aceptas al registrarte y que forma parte de estos términos.'
      ]
    },
    {
      titulo: '12. Cambios a estos términos',
      parrafos: [
        'No modificaremos estos términos de forma unilateral (LODC, art. 43 num. 5). Si necesitamos cambiarlos, publicaremos la nueva versión con su fecha y te avisaremos en la aplicación; se aplicarán a tu cuenta cuando los aceptes.',
        'Si no los aceptas, puedes dejar de usar la plataforma y eliminar tu cuenta sin costo. Los pedidos hechos antes del cambio se rigen por la versión vigente cuando los hiciste.'
      ]
    },
    {
      titulo: '13. Duración y terminación',
      parrafos: [
        'Este contrato dura mientras tengas una cuenta. Puedes terminarlo en cualquier momento, sin costo ni penalidad, eliminando tu cuenta en Perfil → Privacidad y datos (si no tienes pedidos en curso) o escribiéndonos.'
      ]
    },
    {
      titulo: '14. Ley aplicable y solución de controversias',
      parrafos: [
        'Estos términos se rigen por las leyes de la República del Ecuador.',
        'Te invitamos a buscar primero una solución directa con el restaurante. Si no hay acuerdo, las controversias se resolverán ante los jueces competentes de tu domicilio (LCE, art. 47). No se te impone ningún arbitraje ni mediación obligatorios (LODC, art. 43 num. 4).'
      ]
    },
    {
      titulo: '15. Contacto',
      parrafos: [
        `${RESPONSABLE.razonSocial}. Dirección: ${RESPONSABLE.direccion}. Teléfono: ${RESPONSABLE.telefono}. Correo: ${RESPONSABLE.correo}.`
      ]
    }
  ]
};

const privacidad = {
  tipo: 'privacidad',
  titulo: 'Política de protección de datos personales',
  version: VERSION_LEGAL,
  secciones: [
    {
      titulo: '1. Para qué es esta política',
      parrafos: [
        'La Constitución del Ecuador reconoce tu derecho a la protección de tus datos personales (art. 66 num. 19). Esta política te informa, antes de que nos entregues tus datos, cómo los tratamos y cómo puedes ejercer tus derechos, como exige el artículo 12 de la Ley Orgánica de Protección de Datos Personales (LOPDP).',
        'Se aplica a la aplicación móvil Sabor Politécnico, a su servidor y a la atención del restaurante relacionada con tu cuenta. Se rige por la LOPDP, su Reglamento General y las resoluciones de la Superintendencia de Protección de Datos Personales.'
      ]
    },
    {
      titulo: '2. Responsable del tratamiento',
      parrafos: [
        `${RESPONSABLE.razonSocial}, que opera ${RESPONSABLE.nombre}, es el responsable del tratamiento de tus datos: decide para qué y cómo se tratan (LOPDP, art. 4).`,
        `Domicilio: ${RESPONSABLE.direccion}. Teléfono: ${RESPONSABLE.telefono}. Correo: ${RESPONSABLE.correo}.`
      ]
    },
    {
      titulo: '3. Datos que tratamos',
      parrafos: [
        'Los obtenemos directamente de ti cuando usas la aplicación, salvo el resultado de los pagos con tarjeta, que nos envía Payphone.',
        'Identificación y contacto: número de cédula, RUC o pasaporte; nombres; apellidos; correo electrónico; teléfono (opcional); y tipo de cliente (estudiante, docente, personal administrativo o persona externa).',
        'Cuenta: la contraseña, guardada con cifrado irreversible (nadie puede leerla, ni siquiera el personal), y la versión y la fecha en que aceptaste estos documentos.',
        'Foto de perfil: solo si decides subirla. Es opcional.',
        'Pedidos y pagos: productos, cantidades, precios, fecha, hora, modalidad y estado de cada pedido; valor, método, estado y número de referencia de cada pago. En los pagos con tarjeta recibimos de Payphone solo el número de la transacción, el código de autorización, el monto y el resultado; nunca el número de la tarjeta, su fecha de vencimiento ni su código de seguridad.',
        'Seguridad: los códigos de un solo uso para recuperar o cambiar tu contraseña (guardados cifrados; vencen a los 15 minutos) y, si activas el ingreso con huella o rostro, una credencial del dispositivo (guardada cifrada), el nombre del tipo de teléfono y la fecha de su último uso.',
        'Datos técnicos: la dirección IP, la fecha y la hora de las solicitudes que la aplicación hace al servidor, que quedan en sus registros de funcionamiento.',
        'En tu teléfono, protegidos por el sistema operativo, se guardan el código de tu sesión, la hora de tu último uso y, si la activas, la credencial del ingreso con huella o rostro.'
      ]
    },
    {
      titulo: '4. Datos sensibles: no los tratamos',
      parrafos: [
        'La LOPDP considera sensibles, entre otros, los datos de salud y los biométricos (arts. 4 y 26). No los pedimos ni los guardamos.',
        'Si activas el ingreso con huella o rostro, la comparación la hace el sistema de tu teléfono: tu huella y tu rostro nunca salen de él ni llegan a la plataforma. Solo recibimos la confirmación de que la verificación fue exitosa.',
        'Si cuentas al personal una alergia o restricción alimentaria, la usará solo para preparar ese pedido y no se registra en tu cuenta.'
      ]
    },
    {
      titulo: '5. Para qué usamos tus datos y con qué base legal',
      parrafos: [
        'Crear y administrar tu cuenta, identificarte al iniciar sesión, recibir, preparar y entregar tus pedidos, registrar sus pagos y enviarte por correo los códigos para recuperar tu contraseña. Base legal: la ejecución del contrato que aceptas al registrarte (LOPDP, art. 7 num. 5).',
        'Proteger tu cuenta y la plataforma: cerrar sesiones vencidas, limitar los intentos de inicio de sesión, detectar accesos indebidos y conservar registros técnicos. Base legal: nuestro interés legítimo en la seguridad del servicio, que también te protege (arts. 7 num. 8 y 9).',
        'Llevar la contabilidad y cumplir las obligaciones tributarias del restaurante con los registros de pedidos y pagos. Base legal: el cumplimiento de una obligación legal (art. 7 num. 2).',
        'Mostrar tu foto de perfil y permitirte ingresar con huella o rostro. Base legal: tu consentimiento, que das al activar cada opción y que puedes retirar cuando quieras desde Perfil, sin dar explicaciones (arts. 7 num. 1 y 8). Retirarlo no afecta el uso de tu cuenta.',
        'Elaborar estadísticas de ventas del restaurante (por ejemplo, productos más vendidos o ingresos por día), siempre agregadas y sin identificar a nadie. Base legal: interés legítimo (art. 7 num. 8).',
        'Atender requerimientos de autoridades competentes. Base legal: una obligación legal o una orden judicial (art. 7 núms. 2 y 3).',
        'No usamos tus datos para publicidad, no los vendemos, no elaboramos perfiles sobre ti y no tomamos decisiones basadas únicamente en tratamientos automatizados que te afecten (art. 20). Si quisiéramos usarlos para otra finalidad, te lo informaremos y, cuando corresponda, te pediremos antes tu consentimiento.'
      ]
    },
    {
      titulo: '6. Qué pasa si no entregas tus datos o son incorrectos',
      parrafos: [
        'La identificación, los nombres, los apellidos, el correo y el tipo de cliente son necesarios para crear la cuenta: sin ellos no podemos registrarte ni entregarte pedidos a tu nombre. El teléfono, la foto y el ingreso con huella o rostro son opcionales (LOPDP, art. 12).',
        'Si tus datos son incorrectos, puede que no te identifiquemos al retirar tu pedido o que no recibas el código para recuperar tu cuenta. Puedes corregirlos en cualquier momento en Perfil.'
      ]
    },
    {
      titulo: '7. Quién más accede a tus datos',
      parrafos: [
        'El personal del restaurante (caja, cocina, meseros y administración) accede solo a los datos que necesita para atender tus pedidos y pagos, según su cargo.',
        'Encargados del tratamiento: empresas que nos prestan servicios y tratan los datos solo por nuestra cuenta y según nuestras instrucciones, sin usarlos para fines propios (LOPDP, art. 34): Railway (servidor de la aplicación), Supabase (base de datos, alojada en Estados Unidos) y Brevo (envío de los correos con códigos, Unión Europea).',
        'Payphone procesa los pagos con tarjeta: recibe directamente en su página los datos de la tarjeta que escribes y, de nosotros, solo el monto y una referencia del pedido. Trata esos datos conforme a su propia política de privacidad.',
        'La aplicación descarga la tipografía de la interfaz desde los servidores de Google, que pueden registrar la dirección IP del teléfono.',
        'Solo entregamos datos a autoridades cuando una ley o una orden judicial o administrativa competente lo exige. No cedemos ni vendemos tus datos a nadie más.'
      ]
    },
    {
      titulo: '8. Transferencia internacional de datos',
      parrafos: [
        'Como nuestros proveedores alojan los datos fuera del Ecuador (Estados Unidos y la Unión Europea), hay una transferencia internacional de datos. La hacemos con las garantías adecuadas que exige la LOPDP (arts. 55 a 57): los acuerdos de tratamiento de datos que forman parte de los contratos de servicio de cada proveedor, con cláusulas contractuales tipo, les obligan a proteger tus datos con un nivel igual o mayor al de la ley ecuatoriana. Eso no limita tus derechos, que siempre puedes ejercer ante nosotros.'
      ]
    },
    {
      titulo: '9. Cuánto tiempo conservamos tus datos',
      parrafos: [
        'Conservamos los datos solo el tiempo necesario para la finalidad con la que se recogieron (LOPDP, art. 10, principio de conservación):',
        'Datos de tu cuenta y foto de perfil: mientras tu cuenta esté activa. Al eliminarla se borran de inmediato.',
        'Pedidos y pagos: el plazo que exigen las normas tributarias y contables. Si eliminas tu cuenta, se conservan sin ningún dato que te identifique.',
        'Códigos para recuperar la contraseña: hasta que se usan o vencen (15 minutos).',
        'Credencial del ingreso con huella o rostro: hasta que lo desactivas, cambias tu contraseña o eliminas tu cuenta, o tras 30 días sin usarse.',
        'Registros técnicos del servidor: el tiempo que los mantiene el proveedor del servidor para su funcionamiento y seguridad.'
      ]
    },
    {
      titulo: '10. Tus derechos y cómo ejercerlos',
      parrafos: [
        'Tienes derecho a acceder a tus datos (LOPDP, art. 13), rectificarlos y actualizarlos (art. 14), pedir que se eliminen (art. 15), oponerte a su tratamiento (art. 16), recibirlos en un formato estructurado o pedir que se transmitan a otro responsable (portabilidad, art. 17), pedir la suspensión del tratamiento (art. 19), no ser objeto de decisiones basadas únicamente en tratamientos automatizados (art. 20) y revocar tu consentimiento en cualquier momento (art. 8). Ejercerlos es gratis y no necesitas justificarlo.',
        'Desde la aplicación: en Perfil puedes corregir tus datos, cambiar o quitar tu foto y desactivar el ingreso con huella o rostro; en Perfil → Privacidad y datos puedes ver y descargar tus datos (acceso y portabilidad) y eliminar tu cuenta.',
        `Por correo: escribe a ${RESPONSABLE.correo} desde el correo de tu cuenta e indica qué derecho quieres ejercer. Si escribes desde otro correo, te pediremos verificar tu identidad. Responderemos en un máximo de 15 días (LOPDP, arts. 13 a 16).`,
        'Los adolescentes desde los 15 años pueden ejercer estos derechos directamente; los menores de 15 años, por medio de su representante legal (art. 24).',
        'Si crees que no atendimos tu solicitud o que vulneramos tus derechos, puedes presentar un reclamo ante la Superintendencia de Protección de Datos Personales.'
      ]
    },
    {
      titulo: '11. Cómo protegemos tus datos',
      parrafos: [
        'Aplicamos medidas técnicas y organizativas adecuadas al riesgo, desde el diseño de la plataforma (LOPDP, arts. 37 y 39): conexiones cifradas (HTTPS); contraseñas y códigos guardados con cifrado irreversible; sesiones que vencen; límite de intentos de inicio de sesión; acceso del personal según su cargo; una base de datos cerrada al acceso público, a la que solo entra el servidor de la plataforma; y, en el teléfono, datos de la sesión protegidos por el sistema operativo.',
        'Si ocurriera una vulneración de seguridad que afecte tus datos, la notificaremos a la Superintendencia de Protección de Datos Personales en un máximo de cinco días y, si supone un riesgo para tus derechos, te avisaremos en un máximo de tres días desde que lo sepamos (arts. 43 y 46).'
      ]
    },
    {
      titulo: '12. Niñas, niños y adolescentes',
      parrafos: [
        'La plataforma está dirigida a la comunidad universitaria y al público adulto. Si eres menor de 18 años, tu madre, padre o representante legal debe autorizar la creación de tu cuenta y conocer esta política (LOPDP, art. 12).'
      ]
    },
    {
      titulo: '13. Cambios a esta política',
      parrafos: [
        'Cada versión lleva su fecha. Si hacemos cambios que afecten tus derechos o las finalidades del tratamiento, te avisaremos en la aplicación y te pediremos aceptarlos antes de aplicarlos.'
      ]
    }
  ]
};

export const DOCUMENTOS_LEGALES = { terminos, privacidad };

/**
 * Página pública para pedir la eliminación de la cuenta (Google Play exige
 * un enlace web además de la opción dentro de la app). No forma parte de lo
 * que se acepta al registrarse.
 */
export const ELIMINAR_CUENTA = {
  tipo: 'eliminar-cuenta',
  titulo: 'Eliminar tu cuenta de Sabor Politécnico',
  version: VERSION_LEGAL,
  secciones: [
    {
      titulo: 'Desde la aplicación',
      parrafos: [
        'Inicia sesión y entra a Perfil → Privacidad y datos → Eliminar mi cuenta, y confirma con tu contraseña. La eliminación es inmediata, gratuita y no se puede deshacer (LOPDP, art. 15).',
        'Si tienes un pedido en curso, espera a que se entregue o se cancele antes de eliminar la cuenta.'
      ]
    },
    {
      titulo: 'Sin la aplicación',
      parrafos: [
        `Escribe a ${RESPONSABLE.correo} desde el correo registrado en tu cuenta, con el asunto "Eliminar mi cuenta". La eliminaremos en un máximo de 15 días y te lo confirmaremos por correo.`
      ]
    },
    {
      titulo: 'Qué se elimina y qué se conserva',
      parrafos: [
        'Se eliminan tu identificación, nombres, apellidos, correo electrónico, teléfono, foto de perfil, contraseña y el ingreso con huella o rostro de tus dispositivos. Ya no podrás iniciar sesión con esa cuenta.',
        'Los pedidos y pagos se conservan sin ningún dato que te identifique, por las obligaciones contables y tributarias del restaurante.'
      ]
    }
  ]
};
