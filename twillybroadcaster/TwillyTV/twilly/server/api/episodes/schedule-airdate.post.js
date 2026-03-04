import AWS from 'aws-sdk'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { episodeId, userId, seriesName, airdate } = body

    if (!episodeId || !userId || !seriesName || !airdate) {
      return {
        success: false,
        message: 'Missing required parameters: episodeId, userId, seriesName, airdate'
      }
    }

    console.log('Scheduling airdate:', {
      episodeId,
      userId,
      seriesName,
      airdate
    })

    // Check if airdate is in the past or current time
    const now = new Date()
    const scheduledTime = new Date(airdate)
    const isPastOrCurrent = scheduledTime <= now

    if (isPastOrCurrent) {
      console.log('Airdate is in the past or current time, making episode visible immediately')
      // For immediate visibility, use synchronous invocation
      const lambda = new AWS.Lambda({
        region: 'us-east-1',
        accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
        secretAccessKey: '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'
      })

      const lambdaPayload = {
        episodeId,
        userId,
        seriesName,
        airdate: new Date(airdate).toISOString()
      }

      const lambdaResponse = await lambda.invoke({
        FunctionName: 'update-episode-visibility',
        InvocationType: 'RequestResponse', // Synchronous for immediate visibility
        Payload: JSON.stringify(lambdaPayload)
      }).promise()

      console.log('Lambda invocation response:', lambdaResponse)
      
      return {
        success: true,
        message: 'Episode made visible immediately',
        data: {
          episodeId,
          airdate,
          immediate: true,
          requestId: lambdaResponse.ResponseMetadata?.RequestId
        }
      }
    } else {
      console.log('Airdate is in the future, starting Step Function execution')
      
      // For future airdates, start Step Function execution
      const stepfunctions = new AWS.StepFunctions({
        region: 'us-east-1',
        accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
        secretAccessKey: '81v8RfOXhFHoKvOyD5t4I8kIeaVq9ad9TSAnp7eI'
      })
      
      const safeEpisodeId = episodeId.replace(/[^a-zA-Z0-9-]/g, '-')
      const executionParams = {
        stateMachineArn: `arn:aws:states:us-east-1:142770202579:stateMachine:AirdateScheduler`,
        name: `airdate-${safeEpisodeId}-${Date.now()}`,
        input: JSON.stringify({
          episodeId,
          userId,
          seriesName,
          airdate: new Date(airdate).toISOString()
        })
      }
      
      const stepFunctionResponse = await stepfunctions.startExecution(executionParams).promise()
      console.log('Step Function execution started:', stepFunctionResponse.executionArn)

      return {
        success: true,
        message: 'Airdate scheduled successfully',
        data: {
          episodeId,
          airdate,
          immediate: false,
          executionArn: stepFunctionResponse.executionArn
        }
      }
    }

  } catch (error) {
    console.error('Error scheduling airdate:', error)
    return {
      success: false,
      message: 'Failed to schedule airdate',
      error: error.message
    }
  }
}) 