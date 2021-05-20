import { Response, Request, Cookies, Body, jwtVerify } from "../../../deps.ts";
import { config } from "../../../config/config.ts";
import * as usuarioModel from "../model/usuario.model.ts";
import * as notificacionModel from "../../notificacion/model/notificacion.model.ts";
import { jwtConfig } from "../../../middlewares/jwt.ts";

/**
 * genera la URL de autenticacion de Google
 * @param {string} redirectUri URL de Callback para recibir el code de Google
 * @returns {Object} json {url: "http://googleAuthUrl.."}
 */

export const getGoogleAuthUrl = async ({
  request,
  response,
}: {
  request: Request;
  //params: { redirect_uri: string };
  response: Response;
}) => {
  if (!request.hasBody) {
    response.status = config.api.status.badRequest.code;
    response.body = { message: config.api.status.badRequest.message };
    return;
  }
  try {
    const body: Body = await request.body();
    const bodyValue = await body.value;

    const url = await usuarioModel.getGoogleAuthUrl(bodyValue.redirectUri);
    if (!url?.esValido) {
      response.status = config.api.status.badRequest.code;
      response.body = { message: config.api.status.badRequest.message };
      return;
    }
    response.status = config.api.status.ok.code;
    response.body = {
      message: config.api.status.ok.message,
      data: url.data,
    };
  } catch (error) {
    console.error(error);
    response.status = config.api.status.InternalServerError.code;
    response.body = { message: config.api.status.InternalServerError.message };
  }
};

/**
 * iniciar sesion con Google
 * @param {string} code: string codigo de acceso generado por Google y recibido enla URI de callback
 * @param {string} redirectUri URL de Callback para recibir el code de Google
 * @returns {jwt: string} Json Web Token, la autenticacion se realiza a traves de Cookies (httpOnly)
 */

export const iniciarSesionGoogle = async (ctx: any) => {
  const request = ctx.request;
  const response = ctx.response;
  const cookies = ctx.cookies;
  //const params = helpers.getQuery(ctx, { mergeParams: true });
  try {
    if (!request.hasBody) {
      response.status = config.api.status.badRequest.code;
      response.body = { message: config.api.status.badRequest.message };
      return;
    }
    const body: Body = await request.body();
    const bodyValue = await body.value;

    const googleAuthResponse = await usuarioModel.getGoogleAccessToken(
      bodyValue.code,
      bodyValue.redirectUri
    );
    if (!googleAuthResponse.esValido) {
      response.status = config.api.status.badRequest.code;
      response.body = {
        message: config.api.status.badRequest.message,
        data: googleAuthResponse.data,
      };
    } else {
      const googleAuthProfile = await usuarioModel.getGoogleProfile(
        googleAuthResponse.data.accessToken
      );
      if (!googleAuthProfile.esValido) {
        response.status = config.api.status.badRequest.code;
        response.body = {
          message: config.api.status.badRequest.message,
          data: googleAuthProfile.data,
        };
      }
      cookies.set("jwt", googleAuthProfile.data.jwt, { httpOnly: true });
      response.status = config.api.status.ok.code;
      response.body = {
        message: config.api.status.ok.message,
        data: googleAuthProfile.data,
      };
      //response.redirect("http://localhost:3000");
    }
  } catch (error) {
    console.error(error);
    response.status = config.api.status.InternalServerError.code;
    response.body = { message: config.api.status.InternalServerError.message };
  }
};

export const iniciarSesion = async ({
  request,
  response,
  cookies,
}: {
  request: Request;
  response: Response;
  cookies: Cookies;
}) => {
  if (!request.hasBody) {
    response.status = config.api.status.badRequest.code;
    response.body = { message: config.api.status.badRequest.message };
  } else {
    try {
      const body: Body = await request.body();
      const usuario = await body.value;
      const usuarioExiste = await usuarioModel.getByEmail(usuario.email);
      if (!usuarioExiste?.esValido) {
        response.status = config.api.status.notFound.code;
        response.body = {
          message: config.api.status.notFound.message,
          data: usuarioExiste?.data,
        };
        return;
      }
      const passwordCorrecto = await usuarioModel.validarPassword(
        usuario.password,
        usuarioExiste.data.password
      );
      console.log(passwordCorrecto);
      if (!passwordCorrecto.esValido) {
        response.status = config.api.status.authorizationRequired.code;
        response.body = {
          message: config.api.status.authorizationRequired.message,
          data: passwordCorrecto.data,
        };
        return;
      }
      const jwt = await usuarioModel.generarJWT(usuarioExiste.data._id);
      cookies.set("jwt", jwt, { httpOnly: true });
      //const { password, ...usuarioResponse } = usuarioExiste.data;

      response.status = config.api.status.ok.code;
      response.body = {
        message: config.api.status.ok.message,
        data: { jwt },
      };
    } catch (error) {
      console.error(error);
      response.status = config.api.status.InternalServerError.code;
      response.body = {
        message: config.api.status.InternalServerError.message,
      };
    }
  }
};
/**
 * registra un usuario en la plataforma y envía una notificación por email para su confirmación
 *
 * @callback requestCallback
 * @param {number} responseCode
 * @param {string} responseMessage
 */
export const registrarse = async ({
  request,
  response,
}: {
  request: Request;
  response: Response;
}) => {
  if (!request.hasBody) {
    response.status = config.api.status.badRequest.code;
    response.body = { message: config.api.status.badRequest.message };
    return;
  }
  try {
    const body: Body = await request.body();
    const usuario = await body.value;
    const nuevoUsuario = await usuarioModel.create(usuario);
    if (!nuevoUsuario?.esValido) {
      response.status = config.api.status.badRequest.code;
      response.body = {
        message: config.api.status.badRequest.message,
        data: nuevoUsuario?.data,
      };
      return;
    }

    const { password, ...usuarioResponse }: any = nuevoUsuario.data;

    //Enviar codigo de confirmacion por email
    const notificacion: any = {
      titulo:
        "Se ha creado una cuenta en la sede electrónica de la Alcaldía de Santiago de Cali",
      tipo: "email",
      email: usuarioResponse.email,
      linkConfirmacion: `<a href='http://localhost:8000/v1/usuario/confirmar-registro/${usuarioResponse.codigoConfirmacion}'>Confirmar registro</a>`,
      contenido: `Señor(a)
          ${usuarioResponse.nombre} ${usuarioResponse.apellido}

          Le informamos que la solicitud de registro para su cuenta de usuario en nuestra plataforma, ha sido procesada exitosamente.

          Para prevenir el abuso de este sitio, se requiere que active su cuenta haciendo clic en el siguiente enlace

          Gracias de nuevo por estar con nosotros.`,
      expira: Date(),
    };
    const notificacionEnviada = await notificacionModel.create(notificacion);
    console.log(notificacionEnviada);

    response.status = config.api.status.created.code;
    response.body = {
      message: config.api.status.created.message,
      data: usuarioResponse,
    };
  } catch (error) {
    console.error(error);
    response.status = config.api.status.InternalServerError.code;
    response.body = {
      message: config.api.status.InternalServerError.message,
    };
  }
};

/**
 * confirmar el registro del usuario a traves del codigo de confirmacion
 * @param {string} codigoConfirmacion - codigo de confirmacion del registro
 */
export const confirmarRegistro = async ({
  params,
  request,
  response,
}: {
  params: { codigo: string };
  request: Request;
  response: Response;
}) => {
  try {
    const updatedUsuario = await usuarioModel.updateConfirmado(
      params.codigo,
      "Confirmación del registro",
      request.ip
    );

    if (updatedUsuario?.esValido) {
      if (updatedUsuario.data) {
        response.status = config.api.status.ok.code;
        response.body = {
          message: config.api.status.ok.message,
          data: updatedUsuario.data,
        };
      } else {
        response.status = config.api.status.notFound.code;
        response.body = { message: config.api.status.notFound.message };
      }
    } else {
      response.status = config.api.status.badRequest.code;
      response.body = {
        message: config.api.status.badRequest.message,
        data: updatedUsuario?.data,
      };
    }
  } catch (error) {
    console.error(error);
    response.status = config.api.status.InternalServerError.code;
    response.body = { message: config.api.status.InternalServerError.message };
  }
};

/**
 * cerrar sesión
 * @param {Object} response - oak Response
 * @param {Object} cookies - oak Cookies
 * @returns {Object} response.body.message
 */
export const cerrarSesion = async ({
  response,
  cookies,
}: {
  response: Response;
  cookies: Cookies;
}) => {
  cookies.delete("jwt");
  response.body = { message: config.api.status.ok.message };
};

/**
 * obtener el usuario autenticado en la sesion actual
 * @param jwt en cookie session
 * @returns {usuario}
 */
export const getMe = async ({
  response,
  cookies,
}: {
  response: Response;
  cookies: Cookies;
}) => {
  const jwt = cookies.get("jwt") || "";
  const payload: any = await jwtVerify(jwt, jwtConfig.secretKey, jwtConfig.alg);
  const usuario = await usuarioModel.getById(payload._id);
  if (!usuario.esValido) {
    response.status = config.api.status.badRequest.code;
    response.body = {
      message: config.api.status.badRequest.message,
      data: usuario.data,
    };
    return;
  }
  response.status = config.api.status.ok.code;
  response.body = {
    message: config.api.status.ok.message,
    data: usuario.data,
  };
};
