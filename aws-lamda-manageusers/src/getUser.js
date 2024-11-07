const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.getUser = async (event) => {
    let response;

    try {
        // Obtener el id del usuario de los parámetros de la ruta
        const { id } = event.pathParameters;

        if (!id) {
            throw new Error("El id del usuario es obligatorio");
        }

        // Configurar los parámetros para la consulta
        const params = {
            TableName: "Client",
            Key: {
                id: id
            }
        };

        // Ejecutar la consulta
        const result = await dynamodb.get(params).promise();

        if (!result.Item) {
            throw new Error("Usuario no encontrado");
        }

        // Respuesta exitosa
        response = {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "rquid": id
            },
            body: JSON.stringify(result.Item)
        };

    } catch (error) {
        console.error("Error al consultar el usuario:", error);

        // Manejo de errores
        let errorMessage = "Error interno del servidor";
        let statusCode = 500;

        if (error.message === "El id del usuario es obligatorio") {
            errorMessage = error.message;
            statusCode = 400;
        } else if (error.message === "Usuario no encontrado") {
            errorMessage = error.message;
            statusCode = 404;
        }

        response = {
            statusCode,
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                statusDesc: errorMessage,
                statusCode,
            }),
        };
    }

    return response;
};