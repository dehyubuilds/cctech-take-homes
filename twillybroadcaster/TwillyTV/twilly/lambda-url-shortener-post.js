const AWS = require('aws-sdk');
const crypto = require('crypto');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });

exports.handler = async (event) => {
  console.log('=== LAMBDA START ===');
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    // Simple test response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: 'https://share.twilly.app/test123'
    };
    
  } catch (error) {
    console.error('=== LAMBDA ERROR ===');
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
}; 