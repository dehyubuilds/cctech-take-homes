import AWS from 'aws-sdk';

const dynamoDb = new AWS.DynamoDB.DocumentClient();

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { username, series } = body;

    console.log('Fetching poster URL for:', { username, series });

    if (!username || !series) {
      return {
        success: false,
        message: 'Username and series are required'
      };
    }

    // Map username to email for DynamoDB lookup
    let email;
    if (username === 'dehsin365') {
      email = 'dehyu.sinyan@gmail.com';
    } else if (username.includes('@')) {
      email = username;
    } else {
      email = 'dehyu.sinyan@gmail.com'; // Default to correct email
    }

    // Decode the series name from URL encoding
    const decodedSeries = decodeURIComponent(series);
    console.log('Looking up poster for email:', email, 'series:', series);
    console.log('URL decoded series:', decodedSeries);

    // Query DynamoDB to get the folder data for this creator and series
    const params = {
      TableName: 'Twilly',
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${email}`,
        ':sk': `FOLDER#${decodedSeries}`
      }
    };

    console.log('DynamoDB query params:', params);

    const result = await dynamoDb.query(params).promise();
    console.log('DynamoDB query result:', result);
    console.log('Query params used:', params);

    if (result.Items && result.Items.length > 0) {
      const folder = result.Items[0];
      const posterUrl = folder.seriesPosterUrl || 'default';
      
      console.log('Found folder:', folder);
      console.log('Found poster URL:', posterUrl);
      
      // If posterUrl is 'default', construct the default URL
      if (posterUrl === 'default') {
        // Map series names to their correct poster filenames
        let posterFilename = 'DsinyanGivzey.jpeg'; // Default
        if (decodedSeries === 'Twilly') {
          posterFilename = 'july4.jpg';
        } else if (decodedSeries === 'Dark Knights Presents - VIP House Party') {
          posterFilename = '3.png'; // Use the correct poster for this series
        } else if (decodedSeries === 'DehCollective') {
          posterFilename = 'DsinyanGivzey.jpeg';
        }
        // Use the same path structure as managefiles.vue: public/series-posters/
        const encodedSeries = encodeURIComponent(decodedSeries);
        const defaultPosterUrl = `https://d3hv50jkrzkiyh.cloudfront.net/public/series-posters/${email}/${encodedSeries}/${posterFilename}`;
        console.log('Using default poster URL:', defaultPosterUrl);
        return {
          success: true,
          posterUrl: defaultPosterUrl
        };
      }
      
      return {
        success: true,
        posterUrl: posterUrl
      };
    } else {
      console.log('No folder found, using default poster');
      // Return default poster URL
      // Map series names to their correct poster filenames
      let posterFilename = 'DsinyanGivzey.jpeg'; // Default
      if (decodedSeries === 'Twilly') {
        posterFilename = 'july4.jpg';
      } else if (decodedSeries === 'Dark Knights Presents - VIP House Party') {
        posterFilename = '3.png'; // Use the correct poster for this series
      } else if (decodedSeries === 'DehCollective') {
        posterFilename = 'DsinyanGivzey.jpeg';
      }
      // Use the same path structure as managefiles.vue: public/series-posters/
      const encodedSeries = encodeURIComponent(decodedSeries);
      const defaultPosterUrl = `https://d3hv50jkrzkiyh.cloudfront.net/public/series-posters/${email}/${encodedSeries}/${posterFilename}`;
      return {
        success: true,
        posterUrl: defaultPosterUrl
      };
    }

  } catch (error) {
    console.error('Error fetching poster URL:', error);
    return {
      success: false,
      message: 'Error fetching poster URL',
      error: error.message
    };
  }
}); 