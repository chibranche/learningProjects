const createConsumer = (consumerTransport, pid, device, socket, kind, slot) => {
    return new Promise(async (resolve, reject) => {
        // Consume from the basics, emit the consumeMedia event, we take the params we get back
        // then run .consume() to get our tracks
        const consumerParams = await socket.emitWithAck('consumeMedia', { rtpCapabilities: device.rtpCapabilities, pid, kind })
        console.log("Consumer created consumerParams :", consumerParams)
        if (consumerParams === "cannotConsume") {
            console.log("ERROR: Cannot consume")
            resolve()
        }
        else if (consumerParams === "consumeFailed") {
            console.log("ERROR: Consume failed")
            resolve()
        } else {
            // We get valid params, use to consume
            const consumer = await consumerTransport.consume(consumerParams)
            console.log("Consume() has finished :", consumer)
            const { track } = consumer
            // Add track events 
            // Then unpause
            await socket.emitWithAck('unpauseConsumer', { pid, kind })
            resolve(consumer)
        }
    })
}

export default createConsumer