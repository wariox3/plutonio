import {useMutation} from '@tanstack/react-query';

import {mensajeUsuario} from '@/core/api';
import {mostrarError} from '@/ui';

import {
  recuperarClaveApi,
  registrarApi,
  reenviarVerificacionApi,
  type DatosRegistro,
} from '../api/auth';

import {reportarFalloAcceso, type FlujoAcceso} from './reporteAcceso';

/** Registro, recuperación y reenvío son públicos: muestran el error del servidor tal cual. */
const alFallar = (error: unknown, flujo: FlujoAcceso, correo: string) => {
  mostrarError(mensajeUsuario(error));
  reportarFalloAcceso(error, flujo, correo).catch(() => undefined);
};

export const useRegistrar = () =>
  useMutation({
    mutationFn: (datos: DatosRegistro) => registrarApi(datos),
    onError: (error, {email}) => alFallar(error, 'registro', email),
  });

export type TipoSolicitudCorreo = 'recuperarClave' | 'reenviarVerificacion';

export const useSolicitarCorreo = (tipo: TipoSolicitudCorreo) =>
  useMutation({
    mutationFn: (email: string) =>
      tipo === 'recuperarClave'
        ? recuperarClaveApi(email)
        : reenviarVerificacionApi(email),
    onError: (error, email) => alFallar(error, tipo, email),
  });
