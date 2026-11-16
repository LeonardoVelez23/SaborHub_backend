import { randomBytes } from 'node:crypto';
import { config } from '../config/env.js';
import { pagoTarjetaService } from '../dependencias.js';
import { RETORNO } from '../services/pagoTarjetaService.js';
import { esUrlDePayphone } from '../services/pasarelas/payphone.js';
import { paginaIrAPago, paginaResultadoPago } from '../legal/paginaPago.js';

/**
 * Pago con tarjeta (RF-22): solo HTTP y páginas. El flujo y las reglas
 * están en services/pagoTarjetaService.js.
 *
 * 1. La app pide `POST /api/v1/pagos/payphone/preparar` y abre el enlace en
 *    el navegador (Payphone no permite webviews).
 * 2. Payphone devuelve al cliente a `GET /pagos/payphone/retorno` (página
 *    pública de este backend), que confirma el resultado con Payphone.
 */

export const prepararPagoPayphone = async (req, res, next) => {
  try {
    const data = await pagoTarjetaService.preparar(req.body?.pedido_id, req.user.id);
    res.status(201).json({ success: true, message: 'Pago iniciado', data });
  } catch (error) {
    next(error);
  }
};

/** Abre en la app la pantalla con el resultado del pago (monto, referencia y estado). */
const enlaceApp = (pedidoId) => `${config.payphone.appUrl}/pedidos/${pedidoId}/pago`;

const responderPagina = (res, status, datos) =>
  res.status(status).type('html').set('Cache-Control', 'no-store').send(paginaResultadoPago(datos));

/** Página según el resultado del retorno: [código HTTP, contenido]. */
const PAGINAS = {
  [RETORNO.APROBADO]: (pedidoId) => [
    200,
    {
      tipo: 'aprobado',
      titulo: 'Pago aprobado',
      mensaje: `Tu pago del pedido #${pedidoId} fue aprobado. Ya puedes volver a la app para seguir tu pedido.`
    }
  ],
  [RETORNO.CANCELADO]: () => [
    200,
    {
      tipo: 'cancelado',
      titulo: 'Pago no realizado',
      mensaje: 'No se hizo ningún cobro. Puedes intentarlo de nuevo desde el detalle de tu pedido o pagar en caja.'
    }
  ],
  [RETORNO.NO_ENCONTRADO]: () => [
    404,
    {
      tipo: 'error',
      titulo: 'Pago no encontrado',
      mensaje: 'No encontramos este pago. Revisa el estado de tu pedido en la app.'
    }
  ],
  [RETORNO.SIN_CONFIRMAR]: () => [
    502,
    {
      tipo: 'error',
      titulo: 'No pudimos confirmar el pago',
      mensaje:
        'Si se hizo un cargo, Payphone lo revierte automáticamente en unos minutos. Revisa tu pedido en la app o acércate a caja.'
    }
  ],
  [RETORNO.NO_COINCIDE]: () => [
    400,
    {
      tipo: 'error',
      titulo: 'No pudimos validar el pago',
      mensaje: 'El pago no coincide con tu pedido. Acércate a caja para revisarlo.'
    }
  ],
  [RETORNO.YA_PAGADO]: () => [
    200,
    {
      tipo: 'error',
      titulo: 'Este pedido ya estaba pagado',
      mensaje: 'Recibimos tu pago, pero el pedido ya tenía otro pago registrado. Acércate a caja para la devolución.'
    }
  ]
};

export const retornoPayphone = async (req, res, next) => {
  try {
    const { id, clientTransactionId, cancelado } = req.query;
    const { resultado, pedidoId } = await pagoTarjetaService.procesarRetorno({
      id,
      referencia: clientTransactionId,
      cancelado
    });
    const [status, datos] = PAGINAS[resultado](pedidoId);
    return responderPagina(res, status, pedidoId ? { ...datos, enlaceApp: enlaceApp(pedidoId) } : datos);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /pagos/payphone/ir?u=<payWithCard>: Payphone rechaza ("No
 * autorizado") los pagos que no llegan desde el "Dominio web" registrado,
 * y lo comprueba con el Referer. Esta página, servida desde nuestro
 * dominio con Referrer-Policy: origin, abre el formulario de Payphone.
 */
export const irAPagoPayphone = (req, res) => {
  const { u } = req.query;
  if (typeof u !== 'string' || !esUrlDePayphone(u)) {
    return responderPagina(res, 400, {
      tipo: 'error',
      titulo: 'Enlace de pago no válido',
      mensaje: 'Vuelve a la app e inténtalo de nuevo desde el detalle de tu pedido.'
    });
  }
  const nonce = randomBytes(16).toString('base64');
  res
    .status(200)
    .type('html')
    .set({
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'origin',
      'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`
    })
    .send(paginaIrAPago({ urlPago: u, nonce }));
};
