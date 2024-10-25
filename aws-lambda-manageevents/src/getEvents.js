const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.getEventById = async (event) => {
    let response;

    try {
        // Obtener el id del evento desde los parámetros de la solicitud
        const eventId = event.pathParameters.id;

        // Parámetros de consulta para obtener el evento por su id
        const params = {
            TableName: 'Eventos', // Nombre de la tabla
            Key: {
                id: eventId
            }
        };

        // Realizar la consulta a DynamoDB
        const data = await dynamodb.get(params).promise();

        // Verificar si se encontró el evento
        if (!data.Item) {
            response = {
                statusCode: 404,
                body: JSON.stringify({ message: 'Evento no encontrado' }),
            };
        } else {
            response = {
                statusCode: 200,
                body: JSON.stringify(data.Item),
            };
        }

    } catch (error) {
        console.error('Error al obtener el evento:', error);
        response = {
            statusCode: 500,
            body: JSON.stringify({
                error: 'No se pudo obtener el evento',
            }),
        };
    }

    return response;
};
