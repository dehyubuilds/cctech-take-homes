import AWS from 'aws-sdk';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { username, series } = body;

    console.log('=== NEW API CALL START ===');
    console.log('Request body:', body);
    console.log('Username from request:', username);
    console.log('Series from request:', series);

    if (!username || !series) {
      throw createError({
        statusCode: 400,
        message: 'Username and series are required'
      });
    }

    const config = useRuntimeConfig();
    
    // Configure AWS SDK
    AWS.config.update({
      region: config.awsRegion || 'us-east-1',
      accessKeyId: config.awsAccessKeyId,
      secretAccessKey: config.awsSecretAccessKey
    });

    const dynamoDb = new AWS.DynamoDB.DocumentClient();

    // Find the user record by scanning for the username
    let userEmail;
    try {
      console.log('=== STEP 1: FINDING USER BY USERNAME ===');
      console.log('Scanning for username:', username);
      
      const scanParams = {
        TableName: 'Twilly',
        FilterExpression: 'PK = :pk AND username = :username',
        ExpressionAttributeValues: {
          ':pk': 'USER',
          ':username': username
        }
      };
      
      console.log('Scan parameters:', scanParams);
      const userResult = await dynamoDb.scan(scanParams).promise();
      console.log('User scan result:', userResult);
      
      if (userResult.Items && userResult.Items.length > 0) {
        const userRecord = userResult.Items[0];
        userEmail = userRecord.email;
        console.log('✅ Found user record:', userRecord);
        console.log('✅ Email extracted:', userEmail);
      } else {
        console.log('❌ No user found for username:', username);
        throw createError({
          statusCode: 404,
          message: `No user found for username: ${username}`
        });
      }
    } catch (error) {
      console.error('❌ Error finding email for username:', error);
      throw createError({
        statusCode: 500,
        message: 'Failed to find user email'
      });
    }

    // Now get the menu items using the email
    const decodedSeries = decodeURIComponent(series);
    console.log('=== STEP 2: LOADING MENU ITEMS ===');
    console.log('Decoded series:', decodedSeries);
    console.log('User email for query:', userEmail);

    // Use the same approach as managefiles.vue - get all files and filter
    console.log('=== STEP 2.5: GETTING ALL FILES ===');
    const allFilesParams = {
      TableName: 'Twilly',
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${userEmail}`
      }
    };

    try {
      const allFilesResult = await dynamoDb.query(allFilesParams).promise();
      console.log('All files found:', allFilesResult.Items.length);
      
      // Filter files using the same logic as managefiles.vue
      const filteredItems = allFilesResult.Items.filter(file => {
        // Skip folders
        if (file.isFolder) {
          console.log(`Skipping folder: ${file.SK}`);
          return false;
        }
        
        // Skip files without fileName
        if (!file.fileName) {
          console.log(`Skipping file without fileName: ${file.SK}`);
          return false;
        }
        
        // Skip thumbnails and quality variants
        if (file.fileName.includes('_0.gif') || 
            (file.fileName.endsWith('.gif') && !file.fileName.includes('_0.gif')) ||
            /_\d{3,4}p\./.test(file.fileName)) {
          console.log(`Skipping thumbnail/quality variant: ${file.fileName}`);
          return false;
        }
        
        // Skip non-visible items
        if (file.isVisible === false) {
          console.log(`Skipping non-visible item: ${file.fileName}`);
          return false;
        }
        
        // For videos, only include if they have HLS URL
        if (file.category === 'Videos' && !file.hlsUrl) {
          console.log(`Skipping video without HLS URL: ${file.fileName}`);
          return false;
        }
        
        // Use the same folder filtering logic as managefiles.vue
        const itemFolderName = file.folderName || file.seriesName;
        const matchesFolder = itemFolderName === decodedSeries;
        
        console.log(`Checking item ${file.fileName}: folderName=${itemFolderName}, target=${decodedSeries}, matches=${matchesFolder}`);
        
        return matchesFolder;
      });
      
      console.log('=== STEP 3: FILTERED ITEMS ===');
      console.log('Filtered items count:', filteredItems.length);
      console.log('Filtered items:', filteredItems.map(item => ({
        fileName: item.fileName,
        folderName: item.folderName,
        category: item.category
      })));

      // Map the filtered items to the format expected by the template
      const menuItems = filteredItems.map(item => ({
        fileName: item.fileName,
        title: item.title || item.fileName,
        description: item.description || 'No description available',
        category: item.category,
        url: item.url,
        hlsUrl: item.hlsUrl,
        price: item.price || 0,
        SK: item.SK,
        PK: item.PK,
        isVisible: item.isVisible
      }));

      console.log('=== STEP 4: FINAL RESULT ===');
      console.log('Final menu items count:', menuItems.length);
      console.log('Final menu items:', menuItems.map(item => ({
        fileName: item.fileName,
        title: item.title,
        category: item.category,
        price: item.price
      })));

      return {
        success: true,
        items: menuItems,
        userEmail: userEmail,
        series: decodedSeries
      };

    } catch (error) {
      console.error('Error getting all files:', error);
      throw createError({
        statusCode: 500,
        message: 'Failed to load files'
      });
    }

  } catch (error) {
    console.error('❌ Error loading menu items by username:', error);
    
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to load menu items'
    });
  }
}); 