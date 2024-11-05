const AWS = require("aws-sdk");
const dynamoDb = new AWS.DynamoDB.DocumentClient();

exports.createCategory = async (event) => {
  const tableName = process.env.TABLE_NAME;
  const { id, Category_EN, Category_ES } = JSON.parse(event.body);

  const params = {
    TableName: "EventosCategorias",
    Item: {
      id: id,
      Category_EN: Category_EN,
      Category_ES: Category_ES,
    },
  };

  try {
    await dynamoDb.put(params).promise();
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Categoria creada exitosamente!" }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Error al crear la categoria: " + error.message,
      }),
    };
  }
};
