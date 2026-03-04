const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const cloudwatchlogs = new AWS.CloudWatchLogs();

async function checkCommentNotificationLogs() {
  console.log('\n🔍 Checking recent comment notification logs...\n');
  
  // Check last 30 minutes
  const endTime = Date.now();
  const startTime = endTime - 30 * 60 * 1000; // 30 minutes ago
  
  // Check Nuxt server logs (if deployed on Lambda or EC2)
  // For Netlify, logs would be in Netlify dashboard
  // For EC2, we'd need to SSH in
  
  // Try to find log groups that might contain Nuxt/server logs
  const possibleLogGroups = [
    '/aws/lambda/nuxt-server',
    '/aws/lambda/twilly-api',
    '/aws/lambda/comments-api',
    '/aws/apigateway/comments',
    '/var/log/nuxt',
    '/var/log/twilly'
  ];
  
  console.log('📋 Searching for log groups...\n');
  
  try {
    // List all log groups
    const logGroups = await cloudwatchlogs.describeLogGroups({
      limit: 50
    }).promise();
    
    console.log(`Found ${logGroups.logGroups.length} log groups\n`);
    
    // Look for log groups that might contain our server logs
    const relevantGroups = logGroups.logGroups.filter(group => 
      group.logGroupName.includes('nuxt') || 
      group.logGroupName.includes('twilly') ||
      group.logGroupName.includes('api') ||
      group.logGroupName.includes('comments')
    );
    
    if (relevantGroups.length === 0) {
      console.log('⚠️  No relevant log groups found in CloudWatch.');
      console.log('   This might mean:');
      console.log('   1. Server is deployed on Netlify (check Netlify dashboard)');
      console.log('   2. Server is on EC2 (need to SSH in)');
      console.log('   3. Logs are in a different AWS account/region\n');
      
      // Check DynamoDB for recent comments instead
      console.log('📊 Checking DynamoDB for recent comments instead...\n');
      await checkRecentComments();
      return;
    }
    
    console.log(`✅ Found ${relevantGroups.length} relevant log group(s):\n`);
    
    for (const group of relevantGroups) {
      console.log(`📋 Checking: ${group.logGroupName}`);
      
      try {
        const logStreams = await cloudwatchlogs.describeLogStreams({
          logGroupName: group.logGroupName,
          orderBy: 'LastEventTime',
          descending: true,
          limit: 5
        }).promise();
        
        if (logStreams.logStreams && logStreams.logStreams.length > 0) {
          for (const stream of logStreams.logStreams.slice(0, 3)) {
            try {
              const events = await cloudwatchlogs.getLogEvents({
                logGroupName: group.logGroupName,
                logStreamName: stream.logStreamName,
                startTime: startTime,
                endTime: endTime,
                limit: 100
              }).promise();
              
              if (events.events && events.events.length > 0) {
                console.log(`\n   📝 Found ${events.events.length} log events in ${stream.logStreamName}`);
                
                // Filter for comment notification logs
                const commentLogs = events.events.filter(event => 
                  event.message && (
                    event.message.includes('comments/post') ||
                    event.message.includes('notification') ||
                    event.message.includes('recipient') ||
                    event.message.includes('Twilly TV') ||
                    event.message.includes('dehyuusername')
                  )
                );
                
                if (commentLogs.length > 0) {
                  console.log(`   ✅ Found ${commentLogs.length} relevant log entries:\n`);
                  commentLogs.forEach(event => {
                    const time = new Date(event.timestamp).toISOString();
                    console.log(`   [${time}] ${event.message}`);
                  });
                }
              }
            } catch (err) {
              console.log(`   ⚠️  Error reading stream: ${err.message}`);
            }
          }
        }
      } catch (err) {
        console.log(`   ⚠️  Error: ${err.message}`);
      }
      
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error checking logs:', error.message);
    console.log('\n📊 Checking DynamoDB for recent comments instead...\n');
    await checkRecentComments();
  }
}

async function checkRecentComments() {
  const dynamodb = new AWS.DynamoDB.DocumentClient();
  const messagingTable = process.env.MESSAGING_TABLE || 'TwillyMessaging';
  
  try {
    // Get recent comments from last 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    // Scan for recent comments (this is not efficient but works for debugging)
    const params = {
      TableName: messagingTable,
      FilterExpression: 'createdAt >= :time',
      ExpressionAttributeValues: {
        ':time': thirtyMinutesAgo
      },
      Limit: 50
    };
    
    const result = await dynamodb.scan(params).promise();
    
    if (result.Items && result.Items.length > 0) {
      console.log(`✅ Found ${result.Items.length} recent comment(s):\n`);
      
      // Sort by creation time
      result.Items.sort((a, b) => {
        const timeA = new Date(a.createdAt || a.timestamp || 0);
        const timeB = new Date(b.createdAt || b.timestamp || 0);
        return timeB - timeA;
      });
      
      result.Items.forEach((comment, index) => {
        const time = new Date(comment.createdAt || comment.timestamp || 0).toISOString();
        console.log(`${index + 1}. [${time}]`);
        console.log(`   Video: ${comment.videoId || comment.PK}`);
        console.log(`   Username: ${comment.username || 'N/A'}`);
        console.log(`   Text: ${(comment.text || '').substring(0, 50)}...`);
        console.log(`   Private: ${comment.isPrivate || false}`);
        console.log(`   Parent: ${comment.parentCommentId || 'none'}`);
        console.log(`   VisibleTo: [${(comment.visibleTo || []).join(', ')}]`);
        console.log('');
      });
    } else {
      console.log('⚠️  No recent comments found in last 30 minutes');
    }
  } catch (error) {
    console.error('❌ Error checking DynamoDB:', error.message);
  }
}

// Run
checkCommentNotificationLogs().catch(console.error);
