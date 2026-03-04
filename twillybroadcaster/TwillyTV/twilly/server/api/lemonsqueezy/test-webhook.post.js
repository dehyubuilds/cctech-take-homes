import AWS from 'aws-sdk';

const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: 'us-east-1'
});

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { testData } = body;

    console.log('Test webhook received:', testData);

    // Simulate a successful order creation
    const mockOrderData = {
      id: 'test_order_' + Date.now(),
      attributes: {
        total: 1000, // $10.00 in cents
        status: 'paid'
      },
      relationships: {
        customer: {
          data: {
            id: 'test_customer_123'
          }
        },
        product: {
          data: {
            id: 'test_product_456'
          }
        }
      }
    };

    // Get customer email (in real webhook, this would come from Lemon Squeezy API)
    const customerEmail = testData.customerEmail || 'test@example.com';
    
    // Get product details from our database
    const productDetails = {
      clipId: testData.contentId || 'test_content_123',
      creatorId: testData.creatorId || 'creator@example.com',
      title: testData.title || 'Test Content',
      price: 10.00
    };

    // Calculate creator earnings (70% of sale price)
    const totalAmount = mockOrderData.attributes.total / 100; // Convert from cents
    const creatorEarnings = totalAmount * 0.7;
    const platformFee = totalAmount * 0.3;

    // Record the purchase
    const purchaseRecord = {
      PK: `USER#${customerEmail}`,
      SK: `PURCHASE#${mockOrderData.id}`,
      orderId: mockOrderData.id,
      contentId: productDetails.clipId,
      creatorId: productDetails.creatorId,
      title: productDetails.title,
      price: totalAmount,
      creatorEarnings: creatorEarnings,
      platformFee: platformFee,
      status: 'active',
      purchasedAt: new Date().toISOString(),
      productId: mockOrderData.relationships.product.data.id
    };

    // Save purchase record
    await dynamodb.put({
      TableName: 'Twilly',
      Item: purchaseRecord
    }).promise();

    // Update creator earnings
    await dynamodb.update({
      TableName: 'Twilly',
      Key: {
        PK: `USER#${productDetails.creatorId}`,
        SK: 'EARNINGS#total'
      },
      UpdateExpression: 'ADD totalEarnings :amount SET updatedAt = :timestamp',
      ExpressionAttributeValues: {
        ':amount': creatorEarnings,
        ':timestamp': new Date().toISOString()
      }
    }).promise();

    console.log('Test purchase recorded successfully:', mockOrderData.id);

    return {
      success: true,
      message: 'Test webhook processed successfully',
      data: {
        orderId: mockOrderData.id,
        customerEmail: customerEmail,
        creatorEarnings: creatorEarnings,
        purchaseRecord: purchaseRecord
      }
    };

  } catch (error) {
    console.error('Test webhook error:', error);
    return {
      success: false,
      message: 'Test webhook failed',
      error: error.message
    };
  }
}); 