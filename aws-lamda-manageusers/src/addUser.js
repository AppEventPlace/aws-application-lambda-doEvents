const { v4 } = require("uuid");
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.addUser = async (event) => {
    let response;

    try {
        // Parsear el cuerpo de la solicitud
        const { nombre, apellido, fechaNacimiento, celular, email, usuario, contraseña } = JSON.parse(event.body);

        if (!nombre || !apellido || !fechaNacimiento || !celular || !email || !usuario || !contraseña) {
            throw new Error("Todos los campos son obligatorios");
        }

        /* Configurar los parámetros para la consulta
        const params = {
            TableName: "Cliente",
            IndexName: "CelularIndex",
            KeyConditionExpression: "celular = :celular",
            ExpressionAttributeValues: {
                ":celular": celular
            }
        };*/

          // Configurar los parámetros para la consulta
          /*const params = {
            TableName: "Cliente",
            Key: {
                CelularIndex: celular
            }
        };*/
        // Ejecutar la consulta
        //const result = await dynamodb.get(params).promise();

        //const result = await dynamodb.query(queryParams).promise();

        if (!result.Item) {
            throw new Error("Usuario no encontrado");
        }

        if (result.Items.length > 0) {
            throw new Error("El usuario con este número de celular ya existe");
        }

        const createDate = new Date();
        const id = celular;
        const rquid = v4();

        console.log("created id: ", id);

        const newTask = {
            rquid,
            id,
            nombre,
            apellido,
            fechaNacimiento,
            celular,
            email,
            usuario,
            contraseña,
            createDate
        };

        // Intentar insertar el nuevo usuario en DynamoDB
        await dynamodb.put({
            TableName: 'Cliente',
            Item: newTask,
        }).promise();

        // Respuesta exitosa
        const statusDesc = "Registro creado exitosamente";
        response = {
            statusCode: 201,
            headers: {
                "Content-Type": "application/json",
                "rquid": rquid
            },
            body: JSON.stringify({
                statusDesc,
                statusCode: 201,
                createDate
            }),
        };

    } catch (error) {
        console.error("Error al agregar el usuario:", error);

        // Manejo de errores
        let errorMessage = "Error interno del servidor";
        let errorDescription = newTask;
        let statusCode = 500;

        if (error.message === "Todos los campos son obligatorios") {
            errorMessage = error.message;
            statusCode = 400;
        } else if (error.message === "El usuario con este número de celular ya existe") {
            errorMessage = error.message;
            statusCode = 409;
        }

        response = {
            statusCode,
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                statusDesc: errorMessage,
                statusMessage: errorDescription,
                statusCode,
            }),
        };
    }

    return response;
};
