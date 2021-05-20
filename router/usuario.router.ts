import { Router } from "../../../deps.ts";
import * as usuarioController from "../controller/usuario.controller.ts";
import { jwtAuth } from "../../../middlewares/jwt.ts";

const usuarioRouter = new Router();

usuarioRouter
  .post("/v1/usuario/registrarse", usuarioController.registrarse)
  .get(
    "/v1/usuario/confirmar-registro/:codigo",
    usuarioController.confirmarRegistro
  )
  .post("/v1/usuario/iniciar-sesion", usuarioController.iniciarSesion)
  .get("/v1/usuario", jwtAuth, usuarioController.getMe)
  .post("/v1/usuario/cerrar-sesion", jwtAuth, usuarioController.cerrarSesion)
  .post(
    "/v1/usuario/iniciar-sesion-google-url",
    usuarioController.getGoogleAuthUrl
  )
  .post(
    "/v1/usuario/iniciar-sesion-google",
    usuarioController.iniciarSesionGoogle
  );

/*
router.get("/book/:id/page/:page", ctx => {
  getQuery(ctx, { mergeParams: true });
});
*/
export default usuarioRouter;
