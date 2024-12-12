const fs = require('fs');
const https = require('https');

const express = require('express');
const socketio = require('socket.io');
const mediasoup = require('mediasoup');

const config = require('./config/config');
const createWorkers = require("./createWorkers")
const createWebRtcTransportBothKinds = require("./createWebRtcTransportBothKinds")

const app = express();
app.use(express.static('public'));

const key = fs.readFileSync('./config/cert.key');
const cert = fs.readFileSync('./config/cert.crt');
const options = { key, cert }
const httpsServer = https.createServer(options, app);

const io = socketio(httpsServer, {
    cors: [`https://localhost:${config.port}`]
});

// GLOBALS
let workers = null
let router = null
// theProducer will be a global, and whoever produced last
let theProducer = null

// Gets mediasoup ready
const initMediaSoup = async () => {
    workers = await createWorkers();
    // Only use the first worker, can use other also
    router = await workers[0].createRouter({
        mediaCodecs: config.routerMediaCodecs
    });
}

initMediaSoup() //Build our mediasoup server/sfu

// socketIo listener
io.on('connect', socket => {
    let thisClientProducerTransport = null
    let thisClientProducer = null
    let thisClientConsumerTransport = null
    let thisClientConsumer = null

    // socket is the client that just connected
    socket.on('getRtpCap', ack => {
        // callback to run
        ack(router.rtpCapabilities)
    })
    socket.on('create-producer-transport', async ack => {
        // create a transport! A producer transport
        const { transport, clientTransportParams } = await createWebRtcTransportBothKinds(router)
        thisClientProducerTransport = transport
        ack(clientTransportParams) //what we send back to the client
    })
    socket.on('connect-transport', async (dtlsParameters, ack) => {
        // Get the dtls info from the client then finish the connection
        try {
            await thisClientProducerTransport.connect(dtlsParameters)
            ack("success")
        }
        catch (error) {
            // Send back error
            console.log("error", error)
            ack("error")
        }
        ack()
    })

    socket.on('start-producing', async ({ kind, rtpParameters }, ack) => {
        try {
            thisClientProducer = await thisClientProducerTransport.produce({ kind, rtpParameters })
            theProducer = thisClientProducer
            thisClientProducer.on('transportclose', () => {
                console.log("Producer transport closed. Just fyi")
                thisClientProducer.close()
            })
            ack(thisClientProducer.id)
        } catch (error) {
            console.log(error)
            ack("error")
        }
    })

    socket.on('create-consumer-transport', async ack => {
        console.log("creating consumer transport")
        // create a transport! A producer transport
        const { transport, clientTransportParams } = await createWebRtcTransportBothKinds(router)
        thisClientConsumerTransport = transport
        console.log("transport created")
        ack(clientTransportParams) //what we send back to the client
    })
    socket.on('connect-consumer-transport', async (dtlsParameters, ack) => {
        //get the dtls info from the client, and finish the connection
        // on success, send success, on fail, send error
        try {
            await thisClientConsumerTransport.connect(dtlsParameters)
            ack("success")
        } catch (error) {
            // something went wrong. Log it, and send back "err"
            console.log(error)
            ack("error")
        }
    })
    socket.on('consume-media', async ({ rtpCapabilities }, ack) => {
        // we will set up our clientConsumer, and send back
        // the params the client needs to do the same
        // make sure there is a producer :) we can't consume without one
        if (!theProducer) {
            ack("noProducer")
        } else if (!router.canConsume({ producerId: theProducer.id, rtpCapabilities })) {
            ack("cannotConsume")
        } else {
            // we can consume... there is a producer and client is able.
            // proceed!
            thisClientConsumer = await thisClientConsumerTransport.consume({
                producerId: theProducer.id,
                rtpCapabilities,
                paused: true, //see docs, this is usually the best way to start
            })
            thisClientConsumer.on('transportclose', () => {
                console.log("Consumer transport closed. Just fyi")
                thisClientConsumer.close()
            })
            const consumerParams = {
                producerId: theProducer.id,
                id: thisClientConsumer.id,
                kind: thisClientConsumer.kind,
                rtpParameters: thisClientConsumer.rtpParameters,
            }
            ack(consumerParams)
        }
    })
    socket.on('unpauseConsumer', async ack => {
        await thisClientConsumer.resume()
    })
    socket.on('close-all', ack => {
        // client has requested to close ALL
        try {
            thisClientConsumerTransport?.close()
            thisClientProducerTransport?.close()
            ack("closed")
        } catch (error) {
            ack("closeError")
        }
    })
})

httpsServer.listen(config.port, () => console.log('Ready on https://localhost:3030/'));