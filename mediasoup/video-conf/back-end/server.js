const fs = require('fs');
const https = require('https');

const express = require('express');
const socketio = require('socket.io');
const mediasoup = require('mediasoup');

const config = require('./config/config');
const createWorkers = require("./utilities/createWorkers")
const getWorker = require("./utilities/getWorker")
const Client = require("./classes/Client")
const Room = require("./classes/Room")

const app = express();
app.use(express.static('public')); //NOT NEEDED, Vite is independant

const key = fs.readFileSync('./config/cert.key');
const cert = fs.readFileSync('./config/cert.crt');
const options = { key, cert }
const httpsServer = https.createServer(options, app);

const io = socketio(httpsServer, {
    cors: [`https://localhost:${config.frontendPort}`]
});

// GLOBALS
let workers = null
// NOTE: router now managed by Room object
// Master rooms array that contains all our Room objects
const rooms = []

// Gets mediasoup ready
const initMediaSoup = async () => {
    workers = await createWorkers();
}

initMediaSoup() //Build our mediasoup server/sfu

// socketIo listener
io.on('connect', socket => {
    // This is where this client/user/socket lives
    let client

    // NOTE: If a socket connection disconnects, it will automatically reconnect
    // We need to manage a way to know if user has already connected to avoid double event listeners
    const handshake = socket.handshake //This is where auth and query live
    // You could now check handshake for token/password/auth etc

    socket.on('joinRoom', async ({ userName, roomName }, ackCb) => {
        let newRoom = false
        client = new Client(userName, socket)

        // Lets find out if the room exists
        let requestedRoom = rooms.find(room => room.roomName === roomName)
        if (!requestedRoom) {
            newRoom = true
            // Make a new room, add a worker and a router
            const workerToUse = await getWorker(workers)
            requestedRoom = new Room(roomName, workerToUse)
            await requestedRoom.createRouter(io)
            // Add room just created to the master array
            rooms.push(requestedRoom)
        }

        // Add the room to the client
        client.room = requestedRoom
        // Add the client to the Room clients
        client.room.addClient(client)
        // Add this socket to the socket room
        socket.join(client.room.roomName)

        // Fetch the first 5 pids in activeSpeakerList
        const audioPidsToCreate = client.room.activeSpeakerList.slice(0, 5)
        // Find the videoPids and make an array with matching indexes
        // for our audioPids
        const videoPidsToCreate = audioPidsToCreate.map((aid) => {
            const producingClient = client.room.clients.find(c => c?.producer?.audio?.id === aid)
            return producingClient?.producer?.video?.id
        })
        // Same with usernames
        const associatedUserNames = audioPidsToCreate.map((aid) => {
            const producingClient = client.room.clients.find(c => c?.producer?.audio?.id === aid)
            return producingClient?.userName
        })

        ackCb({
            routerRtpCapabilities: client.room.router.rtpCapabilities,
            newRoom,
            audioPidsToCreate,
            videoPidsToCreate,
            associatedUserNames
        })
    })

    socket.on("requestTransport", async ({ type, audioPid }, ackCb) => {
        // Wheter producer or consumer, client needs params
        let clientTransportParams

        if (type === "producer") {
            // run addClient, which is part of our Client class
            clientTransportParams = await client.addTransport(type)
        }
        else if (type === "consumer") {
            // We have one transport per client we are streaming from
            // Each transport will have an audio and video producer/consumer
            // We have the audioPid (coming from dominantSpeaker), we need the videoPid
            const producingClient = client.room.clients.find(c => c?.producer?.audio?.id === audioPid)
            const videoPid = producingClient?.producer?.video?.id
            clientTransportParams = await client.addTransport(type, audioPid, videoPid)
        }
        ackCb(clientTransportParams)
    })

    socket.on("connectTransport", async ({ type, dtlsParameters }, ackCb) => {
        if (type === "producer") {
            try {
                await client.upstreamTransport.connect({ dtlsParameters })
                ackCb("success")
            }
            catch (e) {
                console.log("connectTransportError: ", e)
                ackCb("error")
            }
        }
        else if (type === "consumer") {

        }
    })

    socket.on("startProducing", async ({ kind, rtpParameters }, ackCb) => {
        // Will always be producing 
        // Create a producer with the rtpParameters we were sent
        try {
            const newProducer = await client.upstreamTransport.produce({ kind, rtpParameters })
            // Add the producer to this client object
            client.addProducer(kind, newProducer) //Store in client object for future use
            // Send back id for frontend which waits for it
            ackCb(newProducer.id)
        }
        catch (err) {
            console.log("err", err)
            ackCb(err)
        }
        // TODO: if this is an audiotrack, then this is a new possible speaker
        // TODO2: if the room is populated, then let the connected peers know about the new speaker
    })

    socket.on("audioChange", typeOfChange => {
        if (typeOfChange === "mute") {
            client?.producer?.audio?.pause()
        }
        else if (typeOfChange === "unmute") {
            client?.producer?.audio?.resume()
        }
    })

    socket.on("consumeMedia", async ({ rtpCapabilities, pid, kind }, ackCb) => {
        //This will run twice for each peer to consume (video/audio)
        console.log("kind: ", kind, "-  pid: ", pid)
        // We will set up our clientConsumer, and send back the params
        // use the right transport and add/update the consumer in Client
        // Confirm canConsume
        try {
            if (!client.room.router.canConsume({
                producerId: pid,
                rtpCapabilities,
            })) {
                ackCb('cannotConsume')
            }
            else {
                // We can consume
                console.log("TEST CLIENT", client)
                const downstreamTransport = client.downstreamTransports.find(t => {
                    if (kind === "audio") {
                        return t.associatedAudioPid === pid
                    }
                    else if (kind === "video") {
                        return t.associatedVideoPid === pid
                    }
                })

                // Create the consumer with the transport
                const newConsumer = await downstreamTransport.transport.consume({
                    producerId: pid,
                    rtpCapabilities,
                    paused: true //Good practice to start paused, will unpause from FE when ready
                })
                // add this newConsumer to the client
                client.addConsumer(kind, newConsumer, downstreamTransport)
                // Respond with params
                const clientParams = {
                    producerId: pid,
                    id: newConsumer.id,
                    kind: newConsumer.kind,
                    rtpParameters: newConsumer.rtpParameters,
                }

                ackCb(clientParams)
            }
        }
        catch (err) {
            console.error('can not consume: ', err)
            ackCb('consumeFailed')
        }
    })


})

httpsServer.listen(config.port, () => console.log('Ready on https://localhost:3030/'));