
const createProducerTransport = async (socket, device) => new Promise(async (resolve, reject) => {
    // Ask the server to make a transport and send params
    const producerTransportParams = await socket.emitWithAck('requestTransport', { type: "producer" })
    console.log("producerTransportParams", producerTransportParams)
    // Use the device to create a front-end transport to send
    // It takes our object from requestTransport
    const producerTransport = device.createSendTransport(producerTransportParams.clientTransportParams)
    console.log("producerTransport", producerTransport)

    producerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        // emit connectTransport 
        // transport connect event will NOT fire until transport.produce() runs
        // dtslParams are created by the browser, this is neeeded to do the other half of the connection
        console.log("producerTransport connect event has fired", dtlsParameters)

        const connectResp = await socket.emitWithAck('connectTransport', {
            type: "producer",
            dtlsParameters
        })
        console.log("connectResp finished connect", connectResp)

        if (connectResp === "success") {
            // We are connected, move forward with the produce
            callback()
        }
        else if (connectResp === "error") {
            // Connection failed, stop
            errback()
        }
    })

    producerTransport.on('produce', async (parameters, callback, errback) => {
        // emit startProducing event
        console.log("Produce is now running")
        const { kind, rtpParameters } = parameters
        const connectResp = await socket.emitWithAck('startProducing', { kind, rtpParameters })
        console.log("connectResp finished produce", connectResp)
        if (connectResp === "error") {
            errback()
        } else {
            // Else, this is a producer id
            callback({ id: connectResp })
        }
    })

    setInterval(async () => {
        const stats = await producerTransport.getStats()
        for (const report of stats.values()) {
            // console.log(report)
            // if (report.type === "outbound-rtp") {
            //     console.log(report.bytesSent, ' - ', report.packetsSent)
            // }

        }
    }, 1000)

    // Send the transport back to main
    resolve(producerTransport)
})

export default createProducerTransport