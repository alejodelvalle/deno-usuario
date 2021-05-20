import { config } from "../../../config/config.ts";
import * as usuarioConfig from "../config/usuario.config.ts";
//import { create, getNumericDate } from "../../../deps.ts";
import * as usuarioModel from "../../usuario/model/usuario.model.ts";
import { jwtConfig } from "../../../middlewares/jwt.ts";

import {
  Bson,
  v4,
  genSalt,
  hash,
  compare,
  jwtCreate,
  jwtGetNumericDate,
} from "../../../deps.ts";
import {
  usuarioCollection,
  UsuarioSchema,
} from "../collection/usuario.collection.ts";
import * as usuarioValidate from "../collection/usuario.validate.ts";

/**
 *Genera el hash para el password
 *
 * @param {string} password
 * @return {string} hash
 */
const hashPassword = async (password: string) => {
  const salt = await genSalt(8);
  return hash(password, salt);
};

/**
 * crea un usuario
 * @param {Object} usuario <UsuarioSchema>
 * @returns {esValido,data}
 */
export const create = async (usuario: UsuarioSchema) => {
  const usuarioValido: any = usuarioValidate.schema(usuario);
  const validate = await usuarioValidate.usuario(usuarioValido);
  if (validate.esValido) {
    usuarioValido.nombreCompleto = `${usuarioValido.nombre} ${usuarioValido.apellido}`;
    usuarioValido.password = await hashPassword(usuario.password || "");
    usuarioValido.codigoConfirmacion = v4.generate();
    usuarioValido.confirmo = false;
    usuarioValido.activo = false;
    const insertId = await usuarioCollection.insertOne(usuarioValido);
    const nuevoUsuario = await usuarioCollection.findOne({
      _id: insertId,
    });
    return {
      esValido: validate.esValido,
      data: { ...nuevoUsuario, creacion: insertId.getTimestamp() },
    };
  }
  return {
    esValido: validate.esValido,
    data: validate.errores,
  };
};

/**
 * crea un usuario o lo actualiza si este existe, cuando el registro viene
 * desde una cuenta de algún proveedor de servicio OAuth2 (Google, Facebook, Twitter)
 * @param usuario
 * @returns
 */

export const createUpsert = async (usuario: UsuarioSchema) => {
  //  const validate = await usuarioValidate.usuario(usuario, true);
  //if (validate.esValido) {
  const usuarioUpserted: any = await usuarioCollection.updateOne(
    //{ providerUserId: usuario.providerUserId, email: usuario.email },
    { email: usuario.email },
    {
      $set: usuario,
    },
    { upsert: true }
  );
  console.log(
    `${usuarioUpserted.matchedCount} registro encontrado, ${usuarioUpserted.modifiedCount} registro modificado, ${usuarioUpserted.upsertedCount} registro insertado, upsertedId: ${usuarioUpserted.upsertedId}`
  );
  const nuevoUsuario: any = await usuarioCollection.findOne({
    providerUserId: usuario.providerUserId,
  });
  return {
    esValido: true,
    data: {
      ...nuevoUsuario,
      creacion: new Bson.ObjectId(nuevoUsuario._id).getTimestamp(),
    },
  };
};

/**
 * obtener usuario por _id
 * @param _id
 * @returns usuario
 */

export const getById = async (_id: string) => {
  const validate = await usuarioValidate._id({ _id });
  if (validate.esValido) {
    const { password, ...usuario }: any = await usuarioCollection.findOne({
      _id: new Bson.ObjectId(_id),
    });
    if (usuario) {
      return {
        esValido: validate.esValido,
        data: {
          ...usuario,
          creacion: new Bson.ObjectId(_id).getTimestamp(),
        },
      };
    }
    return {
      esValido: validate.esValido,
      data: null,
    };
  }
  return {
    esValido: validate.esValido,
    data: validate.errores,
  };
};

/**
 * obtener usuario por serializedId
 * @param id
 * @returns usuario
 */

export const getBySerializedId = async (serializedId: number) => {
  const validate = await usuarioValidate.serializedId({ serializedId });
  if (validate.esValido) {
    const usuario = await usuarioCollection.findOne({
      serializedId: serializedId,
    });
    if (usuario) {
      return {
        esValido: validate.esValido,
        data: {
          ...usuario,
          creacion: new Bson.ObjectId(usuario._id).getTimestamp(),
        },
      };
    }
    return {
      esValido: validate.esValido,
      data: null,
    };
  }
  return {
    esValido: validate.esValido,
    data: validate.errores,
  };
};

/**
 * trae todos usuarios
 * @returns usuarios
 */

export const get = async () => {
  return await usuarioCollection.find({ nombre: { $ne: null } }).toArray();
};
/**
 *
 * @param email
 * @returns {Object}
 */
export const getByEmail = async (email: string) => {
  const usuario: any = await usuarioCollection.findOne({
    email: email,
  });
  if (usuario) {
    return {
      esValido: true,
      data: usuario,
    };
  }
  return {
    esValido: false,
    data: { email: "El correo electrónico no existe" },
  };
};

/**
 * Compara el password ingresado por el usuario y el password almacenado en la BD
 * @param {string} password ingresado por el usuario
 * @param {string} usuarioPassword el almacenado en la BD
 * @returns
 */
export const validarPassword = async (
  password: string,
  usuarioPassword: string
) => {
  if (await compare(password, usuarioPassword)) {
    return {
      esValido: true,
      data: null,
    };
  }
  return {
    esValido: false,
    data: { password: "El password es incorrecto" },
  };
};

//Apartir de aqui es auth

interface TokenData {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token: string;
}

export interface UserProfile {
  provider: string;
  providerUserId: string;
  displayName?: string;
  name?: {
    familyName?: string;
    givenName?: string;
    middleName?: string;
  };
  emails?: Array<string>;
}

interface AuthData {
  tokenData: TokenData;
  userInfo: UserProfile;
}

export const serializer = async (usuario: any) => {
  console.log("iniciando serializer.....");
  const serializedId = Math.floor(Math.random() * 1000000000);
  try {
    //await exampleDbCreateUpsert(userInfo);
    const nuevoUsuario: any = {
      nombre: usuario.name.familyName,
      apellido: usuario.name.givenName,
      nombreCompleto: usuario.displayName,
      email: usuario.emails[0],
      provider: usuario.provider,
      providerId: usuario.providerUserId,
      serializedId: serializedId,
    };
    const usuarioBD = await usuarioModel.createUpsert(nuevoUsuario);
    console.log(`serializedId: ${serializedId}`);
    console.log("finalizando serializer.....");
    return serializedId;
  } catch (err) {
    console.error(err);
    return err;
    // or return new Error(err);
  }
};

export const deserializer = async (serializedId: number) => {
  try {
    console.log("iniciando deserializer.....");
    console.log(`serializedId: ${serializedId}`);
    const usuario = await usuarioModel.getBySerializedId(serializedId);
    if (!usuario.esValido) {
      console.error(usuario.data);
    }
    console.log(usuario.data);
    console.log("finalizando deserializer.....");
    return usuario.data;
  } catch (err) {
    console.error(err);
    return err;
    // or return new Error(err);
  }
};

export const getGoogleAuthUrl = async (redirectUri: string) => {
  const validate = await usuarioValidate.redirectUri({ redirectUri });
  if (validate.esValido) {
    return {
      esValido: validate.esValido,
      data: {
        url: encodeURI(
          `https://accounts.google.com/o/oauth2/v2/auth?client_id=${
            usuarioConfig.googleAuth.client_id
          }&scope=${usuarioConfig.googleAuth.scope}&redirect_uri=${encodeURI(
            redirectUri
          )}&response_type=${usuarioConfig.googleAuth.response_type}`
        ),
      },
    };
  }
};

export const getGoogleAccessToken = async (
  code: string,
  redirectUri: string
) => {
  //Trar token desde google con el accessCode
  let post = `client_id=${usuarioConfig.googleAuth.client_id}&redirect_uri=${redirectUri}&client_secret=${usuarioConfig.googleAuth.client_secret}&code=${code}&grant_type=authorization_code`;
  console.log(post);
  let response = await fetch("https://www.googleapis.com/oauth2/v4/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: post,
  });
  if (response.status != 200) {
    console.error("Error : Failed to receieve Google access token");
    console.error(response);
    return {
      esValido: false,
      data: { accessToken: "Falla al recibir el Google access token" },
    };
  }
  let jsonResponse = await response.json();
  let accessToken: string = jsonResponse["access_token"];
  return { esValido: true, data: { accessToken: accessToken } };
};

export async function getGoogleProfile(accessToken: string) {
  let response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    method: "GET",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
  });

  if (response.status != 200) {
    console.error("Error : Failed to get Google user information");
    console.error(response);
    return {
      esValido: false,
      data: { accessToken: "Falla al recibir el Google user profile" },
    };
  }
  let googleUserProfile = await response.json();
  console.log(googleUserProfile);
  if (!googleUserProfile.verified_email) {
    return {
      esValido: false,
      data: {
        userProfile:
          "Falla al recibir el Google user profile, verified_email is false",
      },
    };
  }

  const nuevoUsuario: any = {
    nombre: googleUserProfile.given_name,
    apellido: googleUserProfile.family_name,
    nombreCompleto: googleUserProfile.name,
    email: googleUserProfile.email,
    provider: "Google",
    providerUserId: googleUserProfile.id,
    foto: googleUserProfile.picture,
  };

  const usuarioBD = await usuarioModel.createUpsert(nuevoUsuario);
  if (!usuarioBD.esValido) {
    console.log(usuarioBD.data);
    return { esValido: false, data: usuarioBD.data };
  }

  const jwt = await generarJWT(usuarioBD.data._id);
  console.log(usuarioBD.data);
  return { esValido: true, data: { jwt: jwt } };
}

/**
 *Genera el JWT
 *
 * @param {string} _id
 * @return {*}
 */
export const generarJWT = async (_id: string) => {
  return await jwtCreate(
    { alg: jwtConfig.alg, typ: jwtConfig.type },
    { _id: _id, exp: jwtGetNumericDate(jwtConfig.expirationTime) },
    config.jwt.secret
  );
};

/**
 * actualiza los campos confirmado y activo del usuario, cuando se confirma el registro a traves del codigo de confirmación
 * @param {string} codigo
 * @param {string} modificacion
 * @param {string} origen
 * @returns {Object} {esValido: booblean, data: null | Object }
 */
export const updateConfirmado = async (
  codigo: string,
  modificacion: string,
  origen: string
) => {
  const resultado = await usuarioValidate.codigoConfirmacion({
    codigoConfirmacion: codigo,
  });
  if (resultado.esValido) {
    const usuario: any = await usuarioCollection.findOne({
      codigoConfirmacion: codigo,
    });

    if (usuario) {
      let log = usuario.log;
      if (log === undefined) {
        log = [];
      }
      console.log(usuario);
      log.push({ fecha: new Date(), detalle: modificacion, origen: origen });
      const { matchedCount, modifiedCount, upsertedId } =
        await usuarioCollection.updateOne({ _id: usuario._id }, [
          {
            $set: {
              log: log,
              confirmo: true,
              activo: true,
              ultimaModificacion: "$$NOW",
            },
          },
        ]);
      console.log(
        `${matchedCount} registro encontrado, ${modifiedCount} registro modificado`
      );
      const updatedUsuario = await usuarioCollection.findOne({
        _id: new Bson.ObjectId(usuario._id),
      });
      return {
        esValido: resultado.esValido,
        data: {
          ...updatedUsuario,
          creacion: new Bson.ObjectId(usuario._id).getTimestamp(),
        },
      };
    }
    return {
      esValido: resultado.esValido,
      data: null,
    };
  }
  return {
    esValido: resultado.esValido,
    data: resultado.errores,
  };
};
