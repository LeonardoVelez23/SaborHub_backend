/**
 * Pasarela Payphone: "Botón de pago por redirección".
 * Docs: https://docs.payphone.app/boton-de-pago-por-redireccion
 *
 * Implementa el contrato de ./pasarelaPago.js. `ajustes` es
 * `config.payphone` ({apiUrl, token, storeId, responseUrl}); se lee en cada
 * llamada. El ambiente (pruebas o producción) lo define la aplicación
 * creada en Payphone Developer, no la URL.
 */

export class ErrorPayphone extends Error {
  constructor(message, { status, errorCode } = {}) {
    super(message);
    this.name = 'ErrorPayphone';
    this.status = status;
    this.errorCode = errorCode;
  }
}

/** statusCode de Confirm: 2 cancelada, 3 aprobada. */
const APROBADA = 3;

export const crearPasarelaPayphone = (ajustes, { fetch: llamarHttp = (...a) => globalThis.fetch(...a) } = {}) => {
  const llamar = async (ruta, cuerpo) => {
    let res;
    try {
      res = await llamarHttp(`${ajustes.apiUrl}${ruta}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ajustes.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(15000)
      });
    } catch (error) {
      throw new ErrorPayphone(`Sin conexión con Payphone: ${error.message}`);
    }
    const datos = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ErrorPayphone(datos.message || `Payphone respondió ${res.status}`, {
        status: res.status,
        errorCode: datos.errorCode
      });
    }
    return datos;
  };

  return {
    nombre: 'Payphone',

    // El StoreID es opcional: sin él, Payphone usa la tienda del Token.
    configurada: () => Boolean(ajustes.token && ajustes.responseUrl),

    /** El enlace vence a los 10 minutos y debe abrirse en el navegador. */
    preparar: async ({ referencia, centavos, descripcion }) => {
      const cancelacion = new URL(ajustes.responseUrl);
      cancelacion.searchParams.set('clientTransactionId', referencia);
      cancelacion.searchParams.set('cancelado', '1');
      const respuesta = await llamar('/api/button/Prepare', {
        amount: centavos,
        // Los precios del menú son finales: todo el monto va como "sin impuesto".
        amountWithoutTax: centavos,
        currency: 'USD',
        clientTransactionId: referencia,
        ...(ajustes.storeId ? { storeId: ajustes.storeId } : {}),
        reference: descripcion,
        responseUrl: ajustes.responseUrl,
        cancellationUrl: cancelacion.toString(),
        lang: 'es'
      });
      if (!respuesta.payWithCard) {
        throw new ErrorPayphone(`Prepare sin payWithCard: ${JSON.stringify(respuesta)}`);
      }
      return { urlPago: respuesta.payWithCard };
    },

    /** Hay que llamarlo dentro de los 5 minutos o Payphone revierte el cobro. */
    confirmar: async ({ id, referencia }) => {
      const r = await llamar('/api/button/V2/Confirm', { id: Number(id), clientTxId: referencia });
      return {
        aprobada: r.statusCode === APROBADA,
        referencia: r.clientTransactionId,
        centavos: Number(r.amount),
        transaccionId: r.transactionId,
        autorizacion: r.authorizationCode?.toString() ?? null
      };
    }
  };
};

/** Solo se redirige a páginas de Payphone (evita una redirección abierta). */
export const esUrlDePayphone = (texto) => {
  try {
    const url = new URL(texto);
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'payphonetodoesposible.com' || url.hostname.endsWith('.payphonetodoesposible.com'))
    );
  } catch {
    return false;
  }
};
