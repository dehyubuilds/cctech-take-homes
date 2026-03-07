import AWS from 'aws-sdk';

const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: 'us-east-1'
});

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { PK, fileId, title, description, price, isVisible, airdate, streamKey, status } = body;

    if (!PK || !fileId) {
      return {
        success: false,
        message: 'Missing required fields: PK and fileId are required'
      };
    }

    // Build update expression dynamically based on provided fields
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    if (title !== undefined) {
      updateExpressions.push('#title = :title');
      expressionAttributeNames['#title'] = 'title';
      expressionAttributeValues[':title'] = title || null;
    }

    if (description !== undefined) {
      updateExpressions.push('#description = :description');
      expressionAttributeNames['#description'] = 'description';
      expressionAttributeValues[':description'] = description || null;
    }

    if (price !== undefined) {
      updateExpressions.push('#price = :price');
      expressionAttributeNames['#price'] = 'price';
      expressionAttributeValues[':price'] = price || 0;
    }

    if (isVisible !== undefined) {
      updateExpressions.push('#isVisible = :isVisible');
      expressionAttributeNames['#isVisible'] = 'isVisible';
      expressionAttributeValues[':isVisible'] = isVisible;
    }

    if (airdate !== undefined) {
      updateExpressions.push('#airdate = :airdate');
      expressionAttributeNames['#airdate'] = 'airdate';
      expressionAttributeValues[':airdate'] = airdate;
    }

    if (status !== undefined) {
      updateExpressions.push('#status = :status');
      expressionAttributeNames['#status'] = 'status';
      expressionAttributeValues[':status'] = status;
    }

    // When setting status to PUBLISHED (e.g. manual release), remove GSI attributes so item leaves ReleaseSchedule index
    let removeClause = '';
    if (status === 'PUBLISHED') {
      removeClause = ' REMOVE releaseStatus, scheduledDropDate';
    }

    if (updateExpressions.length === 0 && !removeClause) {
      return {
        success: false,
        message: 'No fields to update'
      };
    }

    // CRITICAL: NEVER do bulk updates - each video should have unique metadata
    // Bulk updates cause all videos with the same streamKey to have the same metadata
    // Always update only the specific file identified by fileId
    // Bulk update logic is DISABLED - removed to prevent metadata pollution across videos
    const isSpecificFileUpdate = true; // Always treat as specific file update
    
    if (isVisible !== undefined || isSpecificFileUpdate) {
      console.log(`⚠️ Specific file update detected - updating ONLY the specific file (SK: ${fileId}), skipping bulk update`);
      // Skip bulk update entirely and go straight to single file update below
    }
    // Bulk update logic DISABLED - removed to prevent all videos from having same metadata
    // Each video should have unique metadata, not shared across all videos with the same streamKey
    else if (false) { // DISABLED - never do bulk updates
      console.log(`Updating all records for stream key: ${streamKey} (metadata only, no visibility changes)`);
      
      try {
        // Scan for all records with this streamKey
        const scanParams = {
          TableName: 'Twilly',
          FilterExpression: 'streamKey = :streamKey',
          ExpressionAttributeValues: {
            ':streamKey': streamKey
          }
        };

        const scanResult = await dynamodb.scan(scanParams).promise();
        console.log(`Found ${scanResult.Items.length} records to update for stream key: ${streamKey}`);

        if (scanResult.Items.length > 0) {
          // Update all found records (metadata only - title, description, price)
          const updatePromises = scanResult.Items.map(item => {
            const updateParams = {
              TableName: 'Twilly',
              Key: {
                PK: item.PK,
                SK: item.SK
              },
              UpdateExpression: `SET ${updateExpressions.join(', ')}`,
              ExpressionAttributeNames: expressionAttributeNames,
              ExpressionAttributeValues: expressionAttributeValues,
              ReturnValues: 'ALL_NEW'
            };
            return dynamodb.update(updateParams).promise();
          });

          const results = await Promise.all(updatePromises);
          console.log(`Successfully updated ${results.length} records`);

          return {
            success: true,
            message: `Updated ${results.length} duplicate records successfully`,
            data: results[0].Attributes // Return the first updated record
          };
        } else {
          console.log('No duplicate records found, falling back to single record update');
        }
      } catch (scanError) {
        console.error('Error scanning for duplicate records:', scanError);
        // Fall back to single record update
        console.log('Falling back to single record update');
      }
    }

    // Update the single item in DynamoDB (always executed for visibility updates, or as fallback)
    // CRITICAL: Ensure fileId is in the correct format (FILE#file-123)
    // If fileId doesn't start with FILE#, add it (for backward compatibility)
    let skToUse = fileId;
    if (!skToUse.startsWith('FILE#')) {
      console.log(`⚠️ [update-details] fileId "${fileId}" doesn't start with FILE# - adding prefix`);
      skToUse = `FILE#${fileId}`;
    }
    
    // User/FILE data lives in TwillyPublic (3-table model)
    const TABLE_MAIN = 'TwillyPublic';
    console.log(`💾 [update-details] Updating item: PK=${PK}, SK=${skToUse}, title=${title !== undefined ? (title || 'null') : 'not provided'}`);
    
    const setClause = updateExpressions.length > 0 ? `SET ${updateExpressions.join(', ')}` : '';
    const params = {
      TableName: TABLE_MAIN,
      Key: {
        PK: PK,
        SK: skToUse
      },
      UpdateExpression: [setClause, removeClause].filter(Boolean).join(''),
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: Object.keys(expressionAttributeValues).length ? expressionAttributeValues : undefined,
      ReturnValues: 'ALL_NEW'
    };
    if (!params.ExpressionAttributeValues) delete params.ExpressionAttributeValues;

    const result = await dynamodb.update(params).promise();
    
    console.log(`✅ [update-details] Update successful - title in response: ${result.Attributes?.title || 'NOT SET'}`);

    return {
      success: true,
      message: 'Item details updated successfully',
      data: result.Attributes
    };
  } catch (error) {
    console.error('Error updating item details:', error);
    return {
      success: false,
      message: 'Failed to update item details'
    };
  }
}); 