import NetInfo from '@react-native-community/netinfo';
import * as Sentry from '@sentry/react-native';

import {ErrorApi} from '@/core/api';
import {reiniciarHuellas} from '@/core/observabilidad';
import {
  clasificarCausa,
  enmascararCorreo,
  reportarFalloAcceso,
} from '@/features/auth/hooks/reporteAcceso';

const alcance = (Sentry as unknown as {__alcance: Record<string, jest.Mock>})
  .__alcance;

const red = (estado: {isConnected: boolean; type?: string}) =>
  (NetInfo.fetch as jest.Mock).mockResolvedValue({
    type: 'cellular',
    isInternetReachable: true,
    ...estado,
  });

const sinRespuesta = (causa: string) =>
  new ErrorApi({
    codigo: 'SIN_CONEXION',
    mensaje: 'Network Error',
    causa,
    peticion: 'POST /auth/seguridad/login',
    requestId: 'req-9',
  });

describe('reporte de fallos de acceso', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    reiniciarHuellas();
  });

  it('con el teléfono conectado, un login sin respuesta se reporta con su motivo', async () => {
    red({isConnected: true});

    await reportarFalloAcceso(
      sinRespuesta('javax.net.ssl.SSLHandshakeException: Trust anchor'),
      'login',
      'RutaSur@gmail.com',
    );

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(alcance.setTags).toHaveBeenCalledWith({
      origen: 'acceso',
      flujo: 'login',
      causa: 'certificado',
      red: 'cellular',
      internet: true,
    });
    expect(alcance.setExtras).toHaveBeenCalledWith({
      motivo: 'javax.net.ssl.SSLHandshakeException: Trust anchor',
      peticion: 'POST /auth/seguridad/login',
      request_id: 'req-9',
      correo: 'ru***@gmail.com',
    });
    expect(alcance.setFingerprint).toHaveBeenCalledWith([
      'acceso',
      'login',
      'certificado',
    ]);
  });

  it('de verdad sin red no se reporta', async () => {
    red({isConnected: false});
    await reportarFalloAcceso(sinRespuesta('x'), 'login', 'a@b.co');
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('los errores de negocio no se reportan', async () => {
    red({isConnected: true});
    await reportarFalloAcceso(
      new ErrorApi({
        codigo: 'NO_AUTENTICADO',
        mensaje: 'Credenciales inválidas',
        estado: 401,
      }),
      'login',
      'a@b.co',
    );
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('un tiempo agotado con red también se reporta', async () => {
    red({isConnected: true});
    await reportarFalloAcceso(
      new ErrorApi({codigo: 'TIEMPO_AGOTADO', mensaje: 'timeout'}),
      'registro',
      'a@b.co',
    );
    expect(alcance.setFingerprint).toHaveBeenCalledWith([
      'acceso',
      'registro',
      'tiempo',
    ]);
  });

  it('clasifica los motivos nativos', () => {
    expect(clasificarCausa('java.net.UnknownHostException: api')).toBe('dns');
    expect(clasificarCausa('Connection refused')).toBe('conexion');
    expect(clasificarCausa('Unexpected char 0xf1 in header')).toBe('protocolo');
    expect(clasificarCausa(null)).toBe('otra');
  });

  it('enmascara el correo', () => {
    expect(enmascararCorreo(' Ruta5@Gmail.com ')).toBe('ru***@gmail.com');
  });
});
