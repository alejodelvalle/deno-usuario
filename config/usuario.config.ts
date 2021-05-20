//Definicion de constantes globales del modulo usuario

export const googleAuth = {
  client_id:
    "841165938689-727m2d44010puf3ud03j8j3lp73brq38.apps.googleusercontent.com",
  client_secret: "fl_5OMic8CSyiKt2wnbIumga",
  //redirect_uri: "http://localhost:8000/v1/auth/google/callback",
  redirect_uri: "http://localhost:3000", //Debe ser enviada como parametro al request de google-url
  response_type: "code",
  scope: "profile email openid",
  grant_type: "authorization_code",
};
