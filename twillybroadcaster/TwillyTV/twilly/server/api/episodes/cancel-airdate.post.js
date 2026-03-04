import AWS from 'aws-sdk'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { episodeId, userId, seriesName } = body

    if (!episodeId || !userId || !seriesName) {
      return {
        success: false,
        message: 'Missing required parameters: episodeId, userId, seriesName'
      }
    }

    console.log('Canceling airdate:', {
      episodeId,
      userId,
      seriesName
    })

    // Configure AWS Step Functions with hardcoded credentials
    const stepfunctions = new AWS.StepFunctions({
      region: 'us-east-1',
      accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
      secretAccessKey: '81v8RfOXhFHoKvOyD5t4IeaVq9ad9TSAnp7eI'
    })

    // Configure AWS Lambda for immediate visibility update
    const lambda = new AWS.Lambda({
      region: 'us-east-1',
      accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
      secretAccessKey: '81v8RfOXhFHoKvOyD5t4IeaVq9ad9TSAnp7eI'
    })

    // 1. Stop any running Step Function executions for this episode
    try {
      const listExecutionsResponse = await stepfunctions.listExecutions({
        stateMachineArn: `arn:aws:states:us-east-1:142770202579:stateMachine:AirdateScheduler`,
        maxResults: 100
      }).promise()

      const episodeExecutions = listExecutionsResponse.executions.filter(execution => {
        try {
          const input = JSON.parse(execution.input || '{}')
          return input.episodeId === episodeId
        } catch (e) {
          return false
        }
      })

      console.log(`Found ${episodeExecutions.length} executions for episode ${episodeId}`)

      // Stop all running executions for this episode
      for (const execution of episodeExecutions) {
        if (execution.status === 'RUNNING') {
          console.log(`Stopping execution: ${execution.executionArn}`)
          await stepfunctions.stopExecution({
            executionArn: execution.executionArn,
            cause: 'Episode visibility changed to immediate - canceling scheduled airdate'
          }).promise()
        }
      }
    } catch (error) {
      console.error('Error stopping Step Function executions:', error)
      // Continue with the process even if stopping executions fails
    }

    // 2. Update episode visibility to immediate and clear airdate
    const lambdaPayload = {
      episodeId,
      userId,
      seriesName,
      airdate: null, // Clear the airdate completely
      immediate: true
    }

    console.log('Invoking Lambda to update episode visibility:', lambdaPayload)

    const lambdaResponse = await lambda.invoke({
      FunctionName: 'update-episode-visibility',
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify(lambdaPayload)
    }).promise()

    console.log('Lambda invocation response:', lambdaResponse)
    
    // Check if Lambda returned an error
    if (lambdaResponse.FunctionError) {
      console.error('Lambda function error:', lambdaResponse.FunctionError);
      throw new Error(`Lambda function error: ${lambdaResponse.FunctionError}`);
    }
    
    // Parse the Lambda response
    const lambdaResult = JSON.parse(lambdaResponse.Payload.toString());
    console.log('Lambda result:', lambdaResult);
    
    if (lambdaResult.statusCode !== 200) {
      throw new Error(`Lambda returned error: ${lambdaResult.body}`);
    }

    return {
      success: true,
      message: 'Airdate canceled and episode made visible immediately',
      data: {
        episodeId,
        canceled: true,
        immediate: true,
        requestId: lambdaResponse.ResponseMetadata?.RequestId
      }
    }

  } catch (error) {
    console.error('Error canceling airdate:', error)
    return {
      success: false,
      message: 'Failed to cancel airdate',
      error: error.message
    }
  }
}) 