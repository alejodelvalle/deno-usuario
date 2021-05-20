import db from "../../../db/mongodb.ts";
import vs from "https://deno.land/x/value_schema/mod.ts";

export interface UsuarioSchema {
  _id: { $oid: string };
  nombre: string;
  apellido: string;
  nombreCompleto?: string;
  email: { type: string; unique: true };
  provider?: string;
  providerUserId?: { type: string; unique: true };
  foto?: string;
  password?: string;
  confirmo?: boolean;
  codigoConfirmacion?: string;
  activo: boolean;
  ultimaModificacion: Date;
  ultimoLogin: Date;
  log: [
    {
      fecha: Date;
      detalle: string;
      origen: string;
    }
  ];
}

export const usuarioSchema = {
  // schema for input
  nombre: vs.string(),
  apellido: vs.string(),
  email: vs.string(),
  password: vs.string(),
  //  foto: vs.string({ ifUndefined: "" }),
  //  provider: vs.string(),
  //  providerUserId: vs.string(),
  //  confirmo: vs.boolean(),
  //  codigoConfirmacion: vs.string(),
  //  activo: vs.boolean(),
};

export const usuarioCollection = db.collection<UsuarioSchema>("usuario");
