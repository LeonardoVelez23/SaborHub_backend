import { ErrorNegocio } from '../errors/ErrorNegocio.js';
import { aCentavos, comprobarPasarela } from './pasarelas/pasarelaPago.js';
import { SIN_FILTRO } from './alcance.js';

/** Solo un pago pendiente se puede reemplazar por el de la tarjeta. */
const ESTADOS_PAGO_ABIERTOS = ['pendiente'];

/** Resultado del retorno de la pasarela; el controlador arma la página. */
export const RETORNO = {
  APROBADO: 'aprobado',
  CANCELADO: 'cancelado',
  NO_ENCONTRADO: 'no_encontrado',
  SIN_CONFIRMAR: 'sin_confirmar',
  NO_COINCIDE: 'no_coincide',
  YA_PAGADO: 'ya_pagado'
};

/**
 * Pago con tarjeta en línea (RF-22, RN-10). Funciona con cualquier
 * pasarela que cumpla el contrato PasarelaPago.
 *
 * 1. `preparar`: crea el intento y devuelve la URL que abre la app
 *    (`urlIntermedia(urlPago)`; ver /pagos/payphone/ir).
 * 2. `procesarRetorno`: la pasarela devuelve al cliente; se confirma con
 *    ella y, si aprobó por el monto exacto, se registra el pago. La app
 *    nunca decide si el pago se aprobó.
 *
 * Se paga desde que el pedido está solicitado. Si el restaurante lo
 * cancela, el pago pasa a reembolsado (la devolución se hace en la pasarela).
 */
export const crearPagoTarjetaService = ({
  pasarela,
  pedidos,
  pagos,
  intentos,
  transacciones,
  urlIntermedia,
  generarReferencia,
  registro = console
}) => {
  comprobarPasarela(pasarela);

  /**
   * Registra el pago aprobado. Bloquea intento y pedido para no cruzarse
   * con una cancelación del personal ni con un segundo retorno. Devuelve
   * false si el pedido ya tenía otro pago cerrado (cobro duplicado).
   */
  const registrarAprobado = (intento, confirmacion) =>
    transacciones.ejecutar(async (t) => {
      const tx = await intentos.bloquear(intento.id, t);
      if (tx.estado === 'aprobada') return true;

      const pedido = await pedidos.bloquear(tx.pedido_id, t, SIN_FILTRO);
      await intentos.actualizar(
        tx,
        {
          estado: 'aprobada',
          payphone_id: confirmacion.transaccionId,
          codigo_autorizacion: confirmacion.autorizacion?.slice(0, 50) || null
        },
        t
      );

      const datosPago = {
        fecha: new Date(),
        valor: tx.monto,
        metodo_pago: 'tarjeta',
        numero_referencia: `${pasarela.nombre} ${confirmacion.transaccionId}`,
        // Cancelado mientras el cliente pagaba: el dinero se devuelve a mano.
        estado: pedido.estado === 'cancelado' ? 'reembolsado' : 'aprobado'
      };
      const pago = await pagos.bloquearDelPedido(pedido.id, t);
      if (!pago) {
        await pagos.crear({ pedido_id: pedido.id, ...datosPago }, t);
        return true;
      }
      if (ESTADOS_PAGO_ABIERTOS.includes(pago.estado)) {
        await pagos.actualizar(pago, datosPago, t);
        return true;
      }
      return false;
    });

  const cancelar = async (intento) => {
    if (intento.estado === 'iniciada') await intentos.actualizar(intento, { estado: 'cancelada' });
  };

  return {
    preparar: async (pedidoId, clienteId) => {
      if (!pasarela.configurada()) {
        throw new ErrorNegocio('El pago con tarjeta no está disponible por ahora. Puedes pagar en caja.', 503);
      }
      const id = Number(pedidoId);
      if (!Number.isInteger(id) || id <= 0) throw new ErrorNegocio('pedido_id es obligatorio');

      const pedido = await pedidos.buscarConPago(id);
      if (!pedido || pedido.cliente_id !== clienteId) throw new ErrorNegocio('Pedido no encontrado', 404);
      if (pedido.estado === 'cancelado') throw new ErrorNegocio('El pedido está cancelado y no requiere pago');
      if (pedido.pago && !ESTADOS_PAGO_ABIERTOS.includes(pedido.pago.estado)) {
        throw new ErrorNegocio(
          pedido.pago.estado === 'aprobado' ? 'Este pedido ya está pagado' : 'Este pedido ya tiene un pago registrado'
        );
      }

      const intento = await intentos.crear({
        pedido_id: pedido.id,
        client_tx_id: generarReferencia(pedido.id),
        monto: pedido.valor_total
      });

      let urlPago;
      try {
        ({ urlPago } = await pasarela.preparar({
          referencia: intento.client_tx_id,
          centavos: aCentavos(pedido.valor_total),
          descripcion: `Pedido #${pedido.id} · Sabor Politécnico`
        }));
      } catch (error) {
        await intentos.eliminar(intento);
        registro.error(`[${pasarela.nombre}] No se pudo preparar el pago:`, error.message);
        throw new ErrorNegocio('No se pudo iniciar el pago con tarjeta. Inténtalo de nuevo.', 502);
      }

      return { url: urlIntermedia(urlPago), client_transaction_id: intento.client_tx_id };
    },

    /** `{resultado, pedidoId}`; ver RETORNO. */
    procesarRetorno: async ({ id, referencia, cancelado }) => {
      const intento = typeof referencia === 'string' ? await intentos.porReferencia(referencia) : null;
      if (!intento) return { resultado: RETORNO.NO_ENCONTRADO };
      const pedidoId = intento.pedido_id;

      if (intento.estado === 'aprobada') return { resultado: RETORNO.APROBADO, pedidoId };

      if (cancelado || !id || !/^\d+$/.test(String(id))) {
        await cancelar(intento);
        return { resultado: RETORNO.CANCELADO, pedidoId };
      }

      let confirmacion;
      try {
        confirmacion = await pasarela.confirmar({ id, referencia: intento.client_tx_id });
      } catch (error) {
        registro.error(`[${pasarela.nombre}] No se pudo confirmar el pago:`, error.message);
        return { resultado: RETORNO.SIN_CONFIRMAR, pedidoId };
      }

      if (!confirmacion.aprobada) {
        await cancelar(intento);
        return { resultado: RETORNO.CANCELADO, pedidoId };
      }

      const coincide =
        confirmacion.referencia === intento.client_tx_id && confirmacion.centavos === aCentavos(intento.monto);
      if (!coincide) {
        // Aprobado pero no corresponde a este intento: no se registra.
        registro.error(`[${pasarela.nombre}] Confirmación que no coincide con ${intento.client_tx_id}:`, {
          referencia: confirmacion.referencia,
          centavos: confirmacion.centavos
        });
        return { resultado: RETORNO.NO_COINCIDE, pedidoId };
      }

      if (!(await registrarAprobado(intento, confirmacion))) {
        registro.error(
          `[${pasarela.nombre}] Pedido ${pedidoId} ya tenía pago cerrado; cobro ${confirmacion.transaccionId} por devolver.`
        );
        return { resultado: RETORNO.YA_PAGADO, pedidoId };
      }
      return { resultado: RETORNO.APROBADO, pedidoId };
    }
  };
};
