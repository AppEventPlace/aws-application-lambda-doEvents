const AWS = require("aws-sdk");
const dynamoDb = new AWS.DynamoDB.DocumentClient();

exports.updateCategory = async (event) => {
  const tableName = process.env.TABLE_NAME;
  const { id, name } = JSON.parse(event.body);

  const params = {
    TableName: "EventosCategorias",
    Key: {
      id: category_id,
    },
    UpdateExpression: "set #name = :name",
    ExpressionAttributeNames: {
      "#name": "name",
    },
    ExpressionAttributeValues: {
      ":name": name,
    },
  };

  try {
    await dynamoDb.update(params).promise();
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Categoria actualizada exitosamente!" }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Error al actualizar la categoria: " + error.message,
      }),
    };
  }
};
