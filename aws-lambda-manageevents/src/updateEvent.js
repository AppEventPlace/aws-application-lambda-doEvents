const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.updateEvent = async (event) => {
    let response;

    try {
        const eventId = event.pathParameters.id;
        // Parsear el cuerpo de la solicitud para obtener los datos actualizados del evento
        const { id, nombre, fecha, organizador, descripcion } = JSON.parse(event.body);

        // Validar que el ID del evento esté presente
        if (!id) {
            throw new Error("El campo 'id' es obligatorio para actualizar el evento");
        }

        // Configurar los parámetros para la actualización
        const params = {
            TableName: 'Eventos',
            Key: { id },
            UpdateExpression: 'SET #nombre = :nombre, #fecha = :fecha, #organizador = :organizador, #descripcion = :descripcion',
            ExpressionAttributeNames: {
                '#nombre': 'nombre',
                '#fecha': 'fecha',
                '#organizador': 'organizador',
                '#descripcion': 'descripcion'
            },
            ExpressionAttributeValues: {
                ':nombre': nombre,
                ':fecha': fecha,
                ':organizador': organizador,
                ':descripcion': descripcion
            },
            ReturnValues: 'UPDATED_NEW'
        };

        // Realizar la actualización en DynamoDB
        const data = await dynamodb.update(params).promise();

        // Preparar la respuesta
        response = {
            statusCode: 200,
            body: JSON.stringify(data.Attributes),
        };

    } catch (error) {
        console.error('Error al actualizar el evento:', error);
        response = {
            statusCode: error.statusCode || 500,
            body: JSON.stringify({
                error: error.message || 'Error interno del servidor',
            }),
        };
    }

    return response;
};
