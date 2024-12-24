import createConsumer from "./createConsumer"
import createConsumerTransport from "./createConsumerTransport"

const requestTransportToConsume = (consumeData, socket, device, consumers) => {
    // How many transports ? One for each consumer . Or one that handles all consumers ?
    // - If we do one for every consumer
    // POSITIVE: more networking control
    // also if one transport is lost or unstable the others are ok
    // NEGATIVE: it is more confusing to manage
    //
    // - If we do one transport for all consumers
    // POSITIVE: easier to manage, more efficient for the server
    // NEGATIVE: No fine-grain control, single point of failure
    // 
    // We will do ONE TRANSPORT FOR EACH CONSUMER
    // This means every peer has an upstream/downstream transport, server will have 2n transports open (n is number of peers)

    console.log("yo1")

    consumeData.audioPidsToCreate.forEach(async (audioPid, i) => {
        console.log("yo2 ", audioPid, i)
        const videoPid = consumeData.videoPidsToCreate[i]
        // Epecting back transport params for THIS audioPid (up to 5 times)
        const consumerTransportParams = await socket.emitWithAck('requestTransport', { type: "consumer", audioPid })
        console.log("")
        console.log("BUG HERE")
        console.log("consumerTransportParams", consumerTransportParams)

        const consumerTransport = createConsumerTransport(consumerTransportParams.clientTransportParams, device, socket, audioPid)
        const [audioConsumer, videoConsumer] = await Promise.all([
            createConsumer(consumerTransport, audioPid, device, socket, 'audio', i), //i is index to know where to display on client
            createConsumer(consumerTransport, videoPid, device, socket, 'video', i)
        ])

        console.log("audioConsumer", audioConsumer)
        console.log("videoConsumer", videoConsumer)
        // Create a new MediaStream on the clientn with both tracks
        const combinedStream = new MediaStream([audioConsumer?.track, videoConsumer?.track])
        const remoteVideo = document.getElementById(`remote-video-${i}`)

        remoteVideo.srcObject = combinedStream

        consumers[audioPid] = {
            combinedStream,
            userName: consumeData.associatedUserNames[i],
            consumerTransport,
            audioConsumer,
            videoConsumer
        }
    })
}

export default requestTransportToConsume