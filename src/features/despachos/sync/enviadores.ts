import {ErrorApi, traducirError} from '@/core/api';
import {reportarError} from '@/core/observabilidad';
import type {ArchivoOperacion, Enviador} from '@/core/sync';

import {entregarGuiaApi} from '../api/entrega';
import {reportarNovedadApi} from '../api/novedad';

type Peticion = (datos: {
  tenantDespachoId: number;
  datos: unknown;
  archivos: readonly ArchivoOperacion[];
}) => Promise<{ficheros_con_error: number}>;

/**
 * Envía una operación multipart del repartidor (entrega o novedad). Fluor no
 * recibe `id_operacion`: si la acción ya estaba aplicada responde 409 con una
 * marca (`entrega: true`, `novedad: true`), sea un reenvío nuestro o algo que
 * hizo otra persona (docs/offline.md §7.2 y §7.3). Eso cuenta como recibido y
 * los archivos se conservan por si eran de la otra. Si Fluor guardó la
 * operación pero no algún archivo, también se conservan (§8).
 */
const enviadorMultipart =
  (nombre: string, marca: string, peticion: Peticion): Enviador =>
  async ({idOperacion, tenantDespachoId, cuerpo, archivos}) => {
    if (tenantDespachoId === null) {
      throw new ErrorApi({
        codigo: 'NO_ENCONTRADO',
        mensaje: `Esta ${nombre} no tiene un despacho asociado.`,
      });
    }

    try {
      const respuesta = await peticion({
        tenantDespachoId,
        datos: cuerpo,
        archivos,
      });
      const sinSubir = respuesta.ficheros_con_error;
      if (sinSubir > 0) {
        // Fluor guardó la operación pero no todos los archivos, y la app no
        // puede reenviarlos: lo resuelve backend (docs/offline.md §8).
        reportarError(new Error(`Fluor no guardó archivos de una ${nombre}`), {
          nivel: 'warning',
          etiquetas: {origen: 'cola', tipo: nombre, caso: 'ficheros_con_error'},
          extras: {
            id_operacion: idOperacion,
            ficheros_con_error: sinSubir,
            archivos: archivos.length,
          },
          huella: ['cola', 'ficheros_con_error', idOperacion],
        });
      }
      return {conservarArchivos: sinSubir > 0};
    } catch (error) {
      const errorApi = traducirError(error);
      if (errorApi.estado === 409 && errorApi.extras[marca] === true) {
        // Si la gestionó otra persona, la evidencia de este conductor no llegó
        // a Fluor: queda en el teléfono y la oficina debe saberlo (§7.3).
        reportarError(new Error(`${nombre} ya aplicada en Fluor (409)`), {
          nivel: 'warning',
          etiquetas: {origen: 'cola', tipo: nombre, caso: 'ya_aplicada'},
          extras: {
            id_operacion: idOperacion,
            request_id: errorApi.requestId,
            archivos: archivos.length,
          },
          huella: ['cola', 'ya_aplicada', idOperacion],
        });
        return {conservarArchivos: true};
      }
      // Otro 409 ("La guía no está despachada", "El despacho está cerrado") no
      // es que alguien la gestionó: Fluor no la acepta y el conductor debe ver
      // el motivo.
      if (errorApi.estado === 409) {
        throw new ErrorApi({
          codigo: 'PETICION_INVALIDA',
          mensaje: errorApi.message,
          estado: errorApi.estado,
          requestId: errorApi.requestId,
          extras: errorApi.extras,
        });
      }
      throw errorApi;
    }
  };

export const enviarEntrega = enviadorMultipart(
  'entrega',
  'entrega',
  entregarGuiaApi,
);

export const enviarNovedad = enviadorMultipart(
  'novedad',
  'novedad',
  reportarNovedadApi,
);

/** Lo que la feature sabe enviar. Terminar espera su endpoint en Fluor. */
export const enviadoresDespachos: Record<string, Enviador> = {
  entrega: enviarEntrega,
  novedad: enviarNovedad,
};
