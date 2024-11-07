const AWS = require("aws-sdk");
const dynamoDb = new AWS.DynamoDB.DocumentClient();
//const TableName = process.env.TableName;

exports.getCategoryById = async (event) => {
  try {
    //const tableName = process.env.TABLE_NAME;
    //const { id } = event.pathParameters;

    const params = {
      TableName: "EventosCategorias",
    };
    const data = await dynamoDb.scan(params).promise();

    if (data.Items) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: "Preferences fetched successfully!",
          data: data.Items,
        }),
      };
    } else {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Categoria no encontrada" }),
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Error al consultar la categoria: " + error.message,
      }),
    };
  }
};
