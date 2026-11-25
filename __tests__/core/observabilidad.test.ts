import * as Sentry from '@sentry/react-native';

import {
  dejarRastro,
  identificarUsuario,
  reiniciarHuellas,
  reportarError,
} from '@/core/observabilidad';

const alcance = (Sentry as unknown as {__alcance: Record<string, jest.Mock>})
  .__alcance;

describe('observabilidad', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    reiniciarHuellas();
  });

  it('reporta con etiquetas, extras y huella, sin valores vacíos', () => {
    reportarError(new Error('falló'), {
      etiquetas: {origen: 'cola', tipo: undefined},
      extras: {request_id: 'req-1', motivo: null},
      huella: ['cola', 'op-1'],
    });

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(alcance.setTags).toHaveBeenCalledWith({origen: 'cola'});
    expect(alcance.setExtras).toHaveBeenCalledWith({request_id: 'req-1'});
    expect(alcance.setFingerprint).toHaveBeenCalledWith(['cola', 'op-1']);
  });

  it('la misma huella no se repite hasta que pasa la pausa', () => {
    const contexto = {huella: ['api', 'servidor']};
    reportarError(new Error('500'), contexto, 0);
    reportarError(new Error('500'), contexto, 60_000);
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);

    reportarError(new Error('500'), contexto, 11 * 60_000);
    expect(Sentry.captureException).toHaveBeenCalledTimes(2);
  });

  it('sin huella reporta siempre, y convierte lo que no es Error', () => {
    reportarError('texto suelto');
    reportarError('texto suelto');
    expect(Sentry.captureException).toHaveBeenCalledTimes(2);
    expect(Sentry.captureException).toHaveBeenCalledWith(
      new Error('texto suelto'),
    );
  });

  it('identifica solo con el id y la empresa', () => {
    identificarUsuario({id: 7, tenantId: 3});
    expect(Sentry.setUser).toHaveBeenCalledWith({id: '7'});
    expect(Sentry.setTag).toHaveBeenCalledWith('tenant_id', '3');

    identificarUsuario(null);
    expect(Sentry.setUser).toHaveBeenLastCalledWith(null);
    expect(Sentry.setTag).toHaveBeenLastCalledWith('tenant_id', undefined);
  });

  it('deja el rastro con su categoría', () => {
    dejarRastro({categoria: 'navegacion', mensaje: 'Login'});
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'navegacion',
      message: 'Login',
      data: {},
      level: 'info',
    });
  });
});
