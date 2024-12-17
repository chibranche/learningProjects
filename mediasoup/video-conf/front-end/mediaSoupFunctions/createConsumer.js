const createConsumer = (consumerTransport, pid, device, socket, kind, slot) => {
    return new Promise(async (resolve, reject) => {
        // Consume from the basics, emit the consumeMedia event, we take the params we get back
        // then run .consume() to get our tracks
        const consumerParams = await socket.emitWithAck('consumeMedia', { rtpCapabilities: device.rtpCapabilities, pid, kind })
        console.log("Consumer created consumerParams")
        // =...
    })
}

export default createConsumer