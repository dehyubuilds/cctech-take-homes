<template>
  <div></div>
</template>
  
  <script setup>
import AWS from 'aws-sdk'
import { mqtt5, iot } from 'aws-iot-device-sdk-v2'
import { Auth } from 'aws-amplify'

const props = defineProps({
  poolId: String,
  host: String,
  region: String,
})

const emitter = defineEmits(['authStateChanged', 'subscribe'])

onMounted(async () => {
  const creds = await getCreds()
  mountIoT(creds)
})

async function getCreds() {
  try {
    const credentials = await Auth.currentCredentials()
    // console.log(credentials)

    return credentials
  } catch (error) {
    return Promise.reject(error)
  }
}

async function mountIoT(creds) {
  const clientEndpoint = 'a3f2pk3o4q0w2n-ats.iot.us-east-1.amazonaws.com'
  const clientId = 'twilly-' + Math.floor(Math.random() * 100000 + 1)
  const builder =
    iot.AwsIotMqtt5ClientConfigBuilder.newDirectMqttBuilderWithMtlsFromPath(
      clientEndpoint
    )

  builder.withConnectProperties({
    clientId: clientId,
  })
  let config = builder.build()

  let client = new mqtt5.Mqtt5Client(config)

  // const mqttClient = AWSIoTData.device({
  //   region: region,
  //   host: IotHost,
  //   clientId: clientId,
  //   protocol: 'wss',
  //   maximumReconnectTimeMs: 8000,
  //   debug: false,
  //   accessKeyId: creds.accessKeyId,
  //   secretKey: creds.secretAccessKey,
  //   sessionToken: creds.sessionToken
  // });

  // mqttClient.on('connect', function () {
  //   mqttClient.subscribe('twilly');
  // });

  // mqttClient.on('error', async function (err) {
  //   const data = await getCreds();
  //   mqttClient.updateWebSocketCredentials(data.Credentials.AccessKeyId,
  //     data.Credentials.SecretKey,
  //     data.Credentials.SessionToken);
  // });

  // mqttClient.on('message', function (topic, payload) {
  //   const payloadEnvelope = JSON.parse(payload.toString());

  //   switch (payloadEnvelope.type) {
  //     case 'OrderManager.WaitingCompletion':
  //       emitter.emit('newOrder', payloadEnvelope.detail);
  //       break;
  //     case 'ConfigService.ConfigChanged':
  //       emitter.emit('storeState', payloadEnvelope.detail);
  //       break;
  //     case 'OrderManager.OrderCancelled':
  //       emitter.emit('cancelOrder', payloadEnvelope.detail);
  //       break;
  //     case 'OrderManager.OrderCompleted':
  //       emitter.emit('completeOrder', payloadEnvelope.detail);
  //       break;
  //     case 'OrderManager.MakeOrder':
  //       emitter.emit('makeOrder', payloadEnvelope.detail);
  //       break;
  //     case 'OrderProcessor.OrderTimeOut':
  //       emitter.emit('timeoutOrder', payloadEnvelope.detail);
  //       break;
  //   }
  // });
}
</script>