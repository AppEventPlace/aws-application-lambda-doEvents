const { v4 } = require("uuid");
const AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();
const lambda = new AWS.Lambda(); // Para invocar la función Lambda de logs

exports.addUser = async (event) => {
  let response;
  const rquid = v4(); // Generar el RQUID completo aquí para incluirlo en los logs
  const userID = rquid.substring(0, 10); // Acotar el RQUID a las primeras 10 posiciones para usar como userID

  // Función para registrar logs
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

    try {
      await lambda.invoke(params).promise();
      console.log("Log registrado exitosamente.");
    } catch (error) {
      console.error("Error al invocar el Lambda de log:", error);
    }
  };

  try {
    // Parsear el cuerpo de la solicitud
    const {
      name,
      lastName,
      date,
      phone,
      email,
      user,
      password,
      fotoPerfilBase64,
    } = JSON.parse(event.body);

    if (!name || !lastName || !date || !phone || !email || !user || !password) {
      throw new Error("Todos los campos son obligatorios");
    }

    // Verificar si el email ya existe en la tabla Client
    const emailCheckParams = {
      TableName: "Client",
      IndexName: "EmailIndex",
      KeyConditionExpression: "email = :email",
      ExpressionAttributeValues: {
        ":email": email,
      },
    };

    let emailCheckResult;
    try {
      emailCheckResult = await dynamodb.query(emailCheckParams).promise();
    } catch (error) {
      throw new Error("Error al verificar el email en la base de datos");
    }

    if (emailCheckResult.Items.length > 0) {
      throw new Error("El usuario con este email ya existe");
    }

    // Verificar si el phone ya existe en la tabla Client
    const phoneCheckParams = {
      TableName: "Client",
      IndexName: "PhoneIndex", // Asegúrate de tener un índice global secundario (GSI) para phoneNumber
      KeyConditionExpression: "phone = :phone",
      ExpressionAttributeValues: {
        ":phone": phone,
      },
    };

    let phoneCheckResult;
    try {
      phoneCheckResult = await dynamodb.query(phoneCheckParams).promise();
    } catch (error) {
      throw new Error(
        "Error al verificar el número de teléfono en la base de datos"
      );
    }

    // Si ya existe un usuario con este número de teléfono, no se puede registrar
    if (phoneCheckResult.Items.length > 0) {
      throw new Error("El usuario con este número de teléfono ya existe");
    }

    const createDate = new Date();
    /*
        // Subir la foto de perfil a S3
        const bucketName = "doeventprofileimagesbucket";
        const fotoPerfilKey = "fotosPerfil/" + user + ".jpg";
        const fotoPerfilBuffer = Buffer.from(fotoPerfilBase64, "base64");

        const s3Params = {
            Bucket: bucketName,
            Key: fotoPerfilKey,
            Body: fotoPerfilBuffer,
            ContentEncoding: 'base64',
            ContentType: 'image/jpeg'
        };

        await s3.putObject(s3Params).promise();

        // URL de la foto de perfil en S3
        const fotoPerfilUrl = "https://" + bucketName + ".s3.amazonaws.com/" + fotoPerfilKey;*/

    const newTask = {
      rquid,
      id: userID, // Aquí se usa el userID acotado a 10 caracteres
      name,
      lastName,
      date,
      phone,
      email,
      user,
      password,
      createDate,
      //fotoPerfilUrl,
      userStatus: "inactive", // Seteamos el status inicial como 'inactive'
    };

    // Intentar insertar el nuevo usuario en DynamoDB
    await dynamodb
      .put({
        TableName: "Client",
        Item: newTask,
      })
      .promise();

    // Registro exitoso
    const statusDesc = "Registro creado exitosamente";
    response = {
      statusCode: 201,
      headers: {
        "Content-Type": "application/json",
        rquid: rquid,
      },
      body: JSON.stringify({
        success: true,
        message: statusDesc,
        data: {
          userID,
          cliente: { name, lastName, email },
          usuario: user,
          userStatus: "inactive", // Devolvemos el userStatus
        },
      }),
    };

    // Registrar el log del evento exitoso
    await logEvent("createUser", event.body, response.body, 201);
  } catch (error) {
    console.error("Error al agregar el usuario:", error);

    let errorMessage = "Error interno del servidor";
    let errorDescription = error.message;
    let statusCode = 500;

    if (
      error.message === "Todos los campos son obligatorios" ||
      error.message === "El usuario con este email ya existe" ||
      error.message === "El usuario con este número de teléfono ya existe"
    ) {
      errorMessage = error.message;
      statusCode = 400;
    } else if (
      error.message === "Error al verificar el email en la base de datos" ||
      error.message ===
        "Error al verificar el número de teléfono en la base de datos"
    ) {
      errorMessage = error.message;
      statusCode = 500;
    }

    response = {
      statusCode,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: false,
        message: errorMessage,
        desc: errorDescription,
        data: [],
      }),
    };

    // Registrar el log del evento fallido
    await logEvent("createUserError", event.body, response.body, statusCode);
  }

  return response;
};
