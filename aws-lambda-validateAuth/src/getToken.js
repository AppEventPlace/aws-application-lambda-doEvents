const AWS = require('aws-sdk');
const crypto = require('crypto'); // Para calcular el SECRET_HASH
const cognito = new AWS.CognitoIdentityServiceProvider();

const calculateSecretHash = (username, clientId, clientSecret) => {
  const hmac = crypto.createHmac('SHA256', clientSecret);
  hmac.update(username + clientId);
  return hmac.digest('base64');
};

exports.generateToken = async (event) => {
  const { username, password } = JSON.parse(event.body);
  
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET; // Debes establecer esta variable en tu entorno
  const userPoolId = process.env.USER_POOL_ID;

  const params = {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: clientId,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
      SECRET_HASH: calculateSecretHash(username, clientId, clientSecret),
    },
  };

  try {
    const authResult = await cognito.initiateAuth(params).promise();
    return {
      statusCode: 200,
      body: JSON.stringify({
        accessToken: authResult.AuthenticationResult.AccessToken,
        idToken: authResult.AuthenticationResult.IdToken,
        refreshToken: authResult.AuthenticationResult.RefreshToken,
      }),
    };
  } catch (error) {
    console.error('Error during authentication:', error);
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'Authentication failed',
        error: error.message,
      }),
    };
  }
};
