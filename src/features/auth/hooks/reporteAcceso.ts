import NetInfo from '@react-native-community/netinfo';

import {traducirError} from '@/core/api';
import {reportarError} from '@/core/observabilidad';

export type FlujoAcceso =
  'login' | 'registro' | 'recuperarClave' | 'reenviarVerificacion';

/** `ru***@gmail.com`: soporte ubica al conductor sin que el correo completo salga del teléfono. */
export const enmascararCorreo = (correo: string) => {
  const [usuario = '', dominio = ''] = correo.trim().toLowerCase().split('@');
  return `${usuario.slice(0, 2)}***@${dominio}`;
};

const CLASES: [RegExp, string][] = [
  [/ssl|certificate|certpath|trust anchor|handshake/i, 'certificado'],
  [/unknownhost|unable to resolve host|hostname|dns/i, 'dns'],
  [/timeout|timed out/i, 'tiempo'],
  [/refused|reset|unreachable|failed to connect|abort/i, 'conexion'],
  [/unexpected char|protocol|stream/i, 'protocolo'],
];

/** Agrupa los motivos nativos en pocas clases, para ver "40 teléfonos con error de certificado". */
export const clasificarCausa = (causa: string | null) =>
  CLASES.find(([patron]) => patron.test(causa ?? ''))?.[1] ?? 'otra';

/**
 * En el acceso, un fallo sin respuesta con el teléfono conectado no es "sin
 * señal": algo impide llegar a Fluor (certificado, DNS, un bloqueo) y el
 * usuario solo ve "Sin conexión". Se reporta con el motivo técnico. Los
 * errores de negocio (clave incorrecta, cuenta sin verificar) no.
 */
export const reportarFalloAcceso = async (
  error: unknown,
  flujo: FlujoAcceso,
  correo: string,
) => {
  const errorApi = traducirError(error);
  if (
    errorApi.codigo !== 'SIN_CONEXION' &&
    errorApi.codigo !== 'TIEMPO_AGOTADO'
  ) {
    return;
  }
  const red = await NetInfo.fetch().catch(() => null);
  // De verdad sin red: el mensaje que ve el usuario es el correcto.
  if (red?.isConnected === false) return;

  const clase =
    errorApi.codigo === 'TIEMPO_AGOTADO'
      ? 'tiempo'
      : clasificarCausa(errorApi.causa);
  reportarError(new Error(`Acceso sin respuesta (${clase})`), {
    etiquetas: {
      origen: 'acceso',
      flujo,
      causa: clase,
      red: red?.type,
      internet: red?.isInternetReachable,
    },
    extras: {
      motivo: errorApi.causa,
      peticion: errorApi.peticion,
      request_id: errorApi.requestId,
      correo: enmascararCorreo(correo),
    },
    huella: ['acceso', flujo, clase],
  });
};
