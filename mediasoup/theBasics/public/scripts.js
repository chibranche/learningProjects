// Globals
let socket = null
let device = null
let localStream = null
let producerTransport = null
let producer = null
let consumerTransport = null
let consumer = null

// 1. (automatic)
// connect to the server
const initConnect = () => {
    console.log("Init connect")
    socket = io("https://localhost:3030")

    connectButton.innerHTML = "Connecting..."
    connectButton.disabled = true

    // keep the socket listeners in their own place
    addSocketListeners()
}

// 2. create a device
const deviceSetup = async () => {
    console.log(mediasoupClient)
    device = new mediasoupClient.Device();
    const routerRtpCapabilities = await socket.emitWithAck('getRtpCap')

    await device.load({ routerRtpCapabilities });

    console.log("device", device)
    deviceButton.disabled = true
    createProdButton.disabled = false
    createConsButton.disabled = false
    disconnectButton.disabled = false
}

// 3. create a producer
const createProducer = async () => {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });

        localVideo.srcObject = localStream
    }
    catch (e) {
        console.error("GUM createProducerError: ", e)
    }

    // Ask the socket.io server (signaling) for transport info
    const data = await socket.emitWithAck('create-producer-transport')
    const { id, iceParameters, iceCandidates, dtlsParameters } = data

    // Make a transport on the client (producer)
    const transport = device.createSendTransport({
        id,
        iceParameters,
        iceCandidates,
        dtlsParameters,
    })

    producerTransport = transport
    // The transport event connect will not fire until we call transport.producer()
    producerTransport.on("connect", async ({ dtlsParameters }, callback, errback) => {
        // Connect comes with local dtlsParameters, we need to send those to the server
        // so we can finish the connexion
        console.log("Transport connect event has fired", dtlsParameters)
        const resp = await socket.emitWithAck('connect-transport', { dtlsParameters })
        if (resp === "success") {
            // Lets the app know the server succeded in connecting and triggers the produce event
            callback()
        }
        else if (resp === "error") {
            // Lets the app know the server failed to connect and triggers the errback
            errback()
        }
        console.log("resp", resp)
    })

    // Producer has been created and start producing 
    // (part of 4.)
    producerTransport.on("produce", async (parameters, callback, errback) => {
        console.log("Transport produce event has fired", parameters)
        const { kind, rtpParameters } = parameters
        const resp = await socket.emitWithAck('start-producing', { kind, rtpParameters })

        if (resp === "error") {
            errback()
        }
        else {
            // resp contains an ID
            callback({ id: resp })
        }

        console.log("producerTransport produce resp :", resp)
        publishButton.disabled = false
        createConsButton.disabled = false
    })

    createProdButton.disabled = true
    publishButton.disabled = false
}

// 4. publish the producer
const publish = async () => {
    // Usually you look at all the video tracks and do what you need, here we take the 1st one
    const track = localStream.getVideoTracks()[0]
    producer = await producerTransport.produce({ track })
}

// 5. create a consumer
const createConsume = async () => {
    //ask the socket.io server (signaling) for transport information
    const data = await socket.emitWithAck('create-consumer-transport')
    const { id, iceParameters, iceCandidates, dtlsParameters } = data
    // console.log(data)
    // make a transport on the client (producer)!
    const transport = device.createRecvTransport({
        id, iceParameters, iceCandidates, dtlsParameters
    })
    consumerTransport = transport
    consumerTransport.on('connectionstatechange', state => {
        console.log("....connection state change....")
        console.log(state)
    })
    consumerTransport.on('icegatheringstatechange', state => {
        console.log("....ice gathering change....")
        console.log(state)
    })
    // the transport connect event will NOT fire until
    // we call transport.consume()
    consumerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        // console.log("Transport connect event has fired!")
        // connect comes with local dtlsParameters. We need
        // to send these up to the server, so we can finish
        // the connection
        // console.log(dtlsParameters)
        const resp = await socket.emitWithAck('connect-consumer-transport', { dtlsParameters })
        if (resp === "success") {
            //calling callback simply lets the app know, the server
            // succeeded in connecting, so trigger the produce event
            callback()
        } else if (resp === "error") {
            //calling errback simply lets the app know, the server
            // failed in connecting, so HALT everything
            errback()
        }
        console.log(resp)
    })
    createConsButton.disabled = true
    consumeButton.disabled = false
}

const consume = async () => {
    console.log("consume")
    // emit consume-media event. This will get us back the
    // "stuff" that we need to make a consumer, and get the video track
    const consumerParams = await socket.emitWithAck('consume-media', { rtpCapabilities: device.rtpCapabilities })
    if (consumerParams === "noProducer") {
        console.log("There is no producer set up to consume")
    } else if (consumerParams === "cannotConsume") {
        console.log("rtpCapabilities failed. Cannot consume")
    } else {
        // set up our consumer! and add the video to the video tag
        consumer = await consumerTransport.consume(consumerParams)
        const { track } = consumer
        console.log(track)

        //listen for various track events
        track.addEventListener("ended", () => {
            console.log("Track has ended")
        });

        track.onmute = (event) => {
            console.log("Track has muted")
        };

        track.onunmute = (event) => {
            console.log("Track has unmuted")
        };

        // see MDN on MediaStream for A TON more information
        remoteVideo.srcObject = new MediaStream([track])
        console.log("Track is ready... we need to unpause")
        await socket.emitWithAck('unpauseConsumer')
    }
}

const disconnect = async () => {
    console.log("DISCONNECT")
    // we want to close EVERYTHING.
    // send a message to the server, then close here
    const closedResp = await socket.emitWithAck('close-all')
    if (closedResp === "closeError") {
        console.log("Something happened on the server...")
    }
    // it doesn't matter if the server didn't close, we are closing.
    // Now.
    producerTransport?.close()
    consumerTransport?.close()
}

function addSocketListeners() {
    socket.on('connect', () => {
        console.log("connected")
        // This will auto trigger once we are connected
        connectButton.innerHTML = "Connected"
        deviceButton.disabled = false
    })
}