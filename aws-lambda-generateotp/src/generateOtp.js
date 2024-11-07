const AWS = require("aws-sdk");
const crypto = require("crypto");
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const ses = new AWS.SES({ region: "us-east-1" });
const sns = new AWS.SNS(); // Instancia de SNS para el envío de SMS

const OTP_LENGTH = 6; // Longitud del código OTP
const OTP_TTL_MINUTES = 5; // Tiempo de vida en minutos del código OTP
const MAX_ATTEMPTS = 3; // Máximo de intentos fallidos
const LOCK_DURATION_SECONDS = 60 * 60; // Duración del bloqueo en segundos (1 hora)

// Función para generar un código OTP
function generateOTP(length) {
  return crypto
    .randomInt(Math.pow(10, length - 1), Math.pow(10, length))
    .toString();
}

// Función para enviar OTP por correo electrónico usando SES
async function sendOTPEmail(toEmail, otp) {
  const params = {
    Source: process.env.SES_FROM_EMAIL, // Dirección de correo verificada en SES
    Destination: {
      ToAddresses: [toEmail],
    },
    Message: {
      Subject: {
        Data: "Tu código OTP",
      },
      Body: {
        Text: {
          Data: `Tu código OTP es: ${otp}. Este código expirará en ${OTP_TTL_MINUTES} minutos.`,
        },
      },
    },
  };

  return ses.sendEmail(params).promise();
}

// Función para enviar OTP por SMS usando SNS
async function sendOTPSMS(phoneNumber, otp) {
  const params = {
    Message: `Tu código OTP es: ${otp}. Este código expirará en ${OTP_TTL_MINUTES} minutos.`,
    PhoneNumber: phoneNumber,
  };

  return sns.publish(params).promise();
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Función Lambda principal
exports.handler = async (event) => {
  const { action, userId, email, phoneNumber, otp, newPassword } = JSON.parse(
    event.body
  );

  if (!action || (!email && !phoneNumber)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Parámetros inválidos" }),
    };
  }

  // Validar el formato del email si se proporciona
  if (email && !isValidEmail(email)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Formato de email inválido" }),
    };
  }

  try {
    // Flujo original para generación de OTP
    if (action === "generate") {
      if (!userId) {
        return {
          statusCode: 400,
          body: JSON.stringify({ message: "El userId es requerido" }),
        };
      }

      // Validar que el email pertenece al userId
      let customerParams;
      if (email) {
        customerParams = {
          TableName: "Client",
          Key: { id: userId },
        };

        const customerResult = await dynamoDb.get(customerParams).promise();

        if (!customerResult.Item) {
          return {
            statusCode: 404,
            body: JSON.stringify({ message: "Usuario no encontrado" }),
          };
        }

        if (customerResult.Item.email !== email) {
          return {
            statusCode: 400,
            body: JSON.stringify({
              message: "El email no corresponde al userId proporcionado",
            }),
          };
        }
      }
      /*
            // Si se envía phoneNumber, ya no se filtra por userId
           if (phoneNumber) {
                customerParams = {
                    TableName: 'Client',
                    IndexName: 'PhoneIndex',
                    KeyConditionExpression: 'phoneNumber = :phoneNumber',
                    ExpressionAttributeValues: {
                        ':phoneNumber': phoneNumber
                    }
                };
            }
        
            const customerResult = await dynamoDb.query(customerParams).promise();
            const customerExists = email ? customerResult.Item : customerResult.Items.length > 0;
        
            if (!customerExists) {
                return { statusCode: 404, body: JSON.stringify({ message: 'Usuario no encontrado' }) };
            }
            */

      // Generar OTP
      const newOtp = generateOTP(OTP_LENGTH);
      const ttl = Math.floor(Date.now() / 1000) + OTP_TTL_MINUTES * 60;
      const timestamp = Date.now();

      const otpParams = {
        TableName: process.env.OTP_TABLE,
        Item: {
          userId: userId,
          otp: newOtp,
          ttl,
          email: email,
          phoneNumber: phoneNumber,
          timestamp,
          attempts: 0,
        },
      };

      await dynamoDb.put(otpParams).promise();

      // Enviar OTP
      try {
        if (email) {
          await sendOTPEmail(email, newOtp);
        } else if (phoneNumber) {
          await sendOTPSMS(phoneNumber, newOtp);
        }
        return {
          statusCode: 200,
          body: JSON.stringify({ message: "OTP generado y enviado" }),
        };
      } catch (error) {
        return {
          statusCode: 500,
          body: JSON.stringify({
            message: "Error enviando el OTP",
            errorDesc: error.message,
          }),
        };
      }
    }
    // Flujo original para verificación de OTP
    else if (action === "verify") {
      if (!otp) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            message: "El código OTP es requerido para la verificación",
          }),
        };
      }

      const otpParams = {
        TableName: process.env.OTP_TABLE,
        Key: { userId },
      };

      const result = await dynamoDb.get(otpParams).promise();

      if (!result.Item) {
        return {
          statusCode: 404,
          body: JSON.stringify({ message: "OTP no encontrado" }),
        };
      }

      const userOtpData = result.Item;

      if (userOtpData.attempts >= MAX_ATTEMPTS) {
        return {
          statusCode: 403,
          body: JSON.stringify({
            message: "Usuario bloqueado por demasiados intentos fallidos",
          }),
        };
      }

      if (userOtpData.otp === otp) {
        if (userOtpData.ttl >= Math.floor(Date.now() / 1000)) {
          let customerParams;

          if (email) {
            customerParams = {
              TableName: "Client",
              IndexName: "EmailIndex",
              KeyConditionExpression: "email = :email",
              ExpressionAttributeValues: {
                ":email": email,
              },
            };
          } else if (phoneNumber) {
            customerParams = {
              TableName: "Client",
              Key: { id: userId },
            };
          } else {
            return {
              statusCode: 400,
              body: JSON.stringify({
                message: "No se proporcionó un método de validación válido",
              }),
            };
          }

          const customerResult = await dynamoDb.query(customerParams).promise();
          const customer = email
            ? customerResult.Items[0]
            : customerResult.Item;

          if (customer) {
            const updateParams = {
              TableName: "Client",
              Key: { id: customer.id },
              UpdateExpression: "set userStatus = :status, otp = :otp",
              ExpressionAttributeValues: {
                ":status": "active",
                ":otp": otp,
              },
            };

            await dynamoDb.update(updateParams).promise();
            return {
              statusCode: 200,
              body: JSON.stringify({
                message: "OTP verificado y usuario actualizado a estado activo",
              }),
            };
          } else {
            return {
              statusCode: 400,
              body: JSON.stringify({ message: "Usuario no encontrado" }),
            };
          }
        } else {
          return {
            statusCode: 400,
            body: JSON.stringify({ message: "OTP expirado" }),
          };
        }
      } else {
        const updateOtpParams = {
          TableName: process.env.OTP_TABLE,
          Key: { userId },
          UpdateExpression: "set attempts = attempts + :incr",
          ExpressionAttributeValues: {
            ":incr": 1,
          },
        };

        await dynamoDb.update(updateOtpParams).promise();
        return {
          statusCode: 400,
          body: JSON.stringify({ message: "OTP inválido" }),
        };
      }
    }
    // Nuevo action para el cambio de contraseña
    // Nuevo action para cambio de contraseña (sin actualización de contraseña)
    else if (action === "changePassword") {
      let customerParams;

      // Verificar que se proporciona un método de validación (email o teléfono)
      if (email) {
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
      } else if (phoneNumber) {
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
          phoneCheckResult = await dynamodb.get(phoneCheckParams).promise();
        } catch (error) {
          throw new Error(
            "Error al verificar el número de teléfono en la base de datos"
          );
        }

        // Si ya existe un usuario con este número de teléfono, no se puede registrar
        if (phoneCheckResult.Items.length > 0) {
          throw new Error("El usuario con este número de teléfono ya existe");
        }
      } else {
        return {
          statusCode: 400,
          body: JSON.stringify({
            message:
              "No se proporcionó un método de validación válido (email o teléfono)",
          }),
        };
      }

      try {
        // Obtener los datos del cliente (userId)
        const clientResult = await dynamoDb.query(customerParams).promise();

        if (
          !emailCheckResult.Items ||
          emailCheckResult.Items.length ||
          !phoneCheckResult.Items ||
          phoneCheckResult.Items.length === 0
        ) {
          return {
            statusCode: 404,
            body: JSON.stringify({
              message: "Usuario no encontrado en la tabla Client",
            }),
          };
        }

        const userId = clientResult.Items[0].userId; // Recuperamos el userId del cliente

        // Aquí generamos la OTP como normalmente lo harías
        const otp = generateOTP(OTP_LENGTH); // Función que generará el código OTP
        const ttl = Math.floor(Date.now() / 1000) + 300; // Tiempo de vida del OTP (300 segundos = 5 minutos)

        // Guardar el OTP en la tabla OTP
        const otpParams = {
          TableName: process.env.OTP_TABLE,
          Item: {
            userId: userId,
            otp: otp,
            email: email,
            phoneNumber: phoneNumber,
            ttl: ttl,
            attempts: 0, // Inicializar los intentos fallidos a 0
          },
        };

        await dynamoDb.put(otpParams).promise();

        return {
          statusCode: 200,
          body: JSON.stringify({ message: "OTP generado exitosamente", otp }),
        };
      } catch (error) {
        console.error("Error en la generación de OTP:", error);
        return {
          statusCode: 500,
          body: JSON.stringify({
            message: "Error al generar el OTP",
            errorDesc: error.message,
          }),
        };
      }
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Acción no válida" }),
      };
    }
  } catch (error) {
    console.error(
      "Error en la generación, verificación o cambio de contraseña:",
      error
    );
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error en la operación",
        errorDesc: error.message,
      }),
    };
  }
};
