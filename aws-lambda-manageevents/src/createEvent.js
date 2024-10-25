const { v4 } = require("uuid");
const AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();
const lambda = new AWS.Lambda(); // Para invocar la función Lambda de logs

exports.createEvent = async (event) => {
  let response;
  const rquid = v4(); // Generar el RQUID completo aquí para incluirlo en los logs
  const userID = rquid.substring(0, 10); // Acotar el RQUID a las primeras 10 posiciones para usar como userID

  const logEvent = async (action, requestBody, responseBody, statusCode) => {
    const logPayload = {
      rquid,
      action,
      requestBody,
      responseBody,
      statusCode,
    };

    const params = {
      FunctionName: "aws-lambda-auditeventlog-dev", // Reemplaza con el nombre de tu función Lambda de logs
      InvocationType: "Event", // InvocationType 'Event' para ejecución asincrónica
      Payload: JSON.stringify({ body: JSON.stringify(logPayload) }),
    };

    response = {
      statusCode: 201,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: true,
        //statusDesc,
        statusCode: 201,
        //eventoId,
        //createDate,
        newEvent,
      }),
    };
    try {
      await lambda.invoke(params).promise();
      console.log("Log registrado exitosamente.");
    } catch (error) {
      console.error("Error al invocar el Lambda de log:", error);
    }
  };
  const {
    nombre,
    descripcion,
    fechaIni,
    fechaFin,
    horaIni,
    horaFin,
    ubicacion,
    organizerName,
    TelPrin,
    TelSec,
    email,
    userId,
    tipoEvento,
    Categoria,
    aforo,
    modalidadEvt,
    costoEvt,
    clase,
  } = JSON.parse(event.body);
  try {
    // Parsear el cuerpo de la solicitud
    /*const {
      nombre,
      descripcion,
      //calendar: { fechaIni, fechaFin, horaIni, horaFin },
      ubicacion,
      //organizer: { organizerName, TelPrin, TelSec, email },
      userId,
      tipoEvento,
      Categoria,
      aforo,
      modalidadEvt,
      costoEvt,
      clase,
    } = JSON.parse(event.body);*/

    /*if (
      !nombre ||
      !descripcion ||
      !calendar ||
      !fechaIni ||
      !fechaFin ||
      !ubicacion ||
      !organizer ||
      !userId ||
      !tipoEvento ||
      !Categoria ||
      !aforo ||
      !horaIni ||
      !horaFin ||
      !modalidadEvt ||
      !costoEvt ||
      !clase
    ) {
      throw new Error("Todos los campos son obligatorios");
    }*/

    // Generar un ID único para el evento
    const eventoId = v4();
    const createDate = new Date().toISOString();
    const rquid = v4();
    const id = rquid;

    const newEvent = {
      id,
      eventoId,
      nombre,
      descripcion,
      fechaIni,
      fechaFin,
      horaIni,
      horaFin,
      ubicacion,
      organizerName,
      TelPrin,
      TelSec,
      email,
      createDate,
      userId,
      tipoEvento,
      Categoria,
      aforo,
      modalidadEvt,
      costoEvt,
      clase,
    };

    // Intentar insertar el nuevo evento en DynamoDB
    await dynamodb
      .put({
        TableName: "Eventos",
        Item: newEvent,
      })
      .promise();

    // Respuesta exitosa
    const statusDesc = "Evento creado exitosamente";
    response = {
      statusCode: 201,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: true,
        statusDesc,
        statusCode: 201,
        eventoId,
        createDate,
        cuerpo: event,
        //aforo: calendar,
      }),
    };
    //await logEvent("createEvent", event.body, response.body, 201);
  } catch (error) {
    console.error("Error al crear el evento:", error);

    // Manejo de errores
    let errorMessage = "Error interno del servidor";
    let errorDescription = error;
    let statusCode = 500;
    //await logEvent("createEvent", event.body, response.body, 500);
    if (error.message === "Todos los campos son obligatorios") {
      errorMessage = error.message;
      statusCode = 400;
    }

    response = {
      statusCode,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: false,
        statusDesc: errorMessage,
        statusMessage: error,
        statusCode,
        cuerpo: nombre,
      }),
    };
  }

  return response;
};
