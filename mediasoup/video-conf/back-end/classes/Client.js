const config = require('../config/config')


class Client {
    constructor(userName, socket) {
        this.userName = userName
        this.socket = socket
        //this.rooms = [] //Used if you want to build an app where user is in multiple rooms at the same time

        // producer = upstream (pushing data)
        this.upstreamTransport = null
        // We will have an audio and video consumer, need both
        this.producer = {}
        // consumer = downstream (pulling data)
        this.downstreamTransport = [] // {transport, associatedAudioPid, associatedVideoPid, audio=audioConsumer (producer), video=videoConsumer (producer)}


        // The room contains the router if needed
        this.room = null //room object
    }

    addTransport(type, audioPid = null, videoPid = null) {
        return new Promise(async (resolve, reject) => {
            const { initialAvailableOutgoingBitrate, maxIncomingBitrate, listenIps } = config.webRtcTransport

            const transport = await this.room.router.createWebRtcTransport({
                enableUdp: true,
                enableTcp: true, //always use UDP unless we can't
                preferUdp: true,
                listenInfos: listenIps,
                initialAvailableOutgoingBitrate,
            })

            if (maxIncomingBitrate) {
                // If set, will limit max incoming bandwidth from this transporter
                try {
                    await transport.setMaxIncomingBitrate(maxIncomingBitrate)
                }
                catch (e) {
                    console.log("error setting max incoming bitrate", e)
                }
            }

            // console.log(transport)
            const clientTransportParams = {
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
            }

            if (type === "producer") {
                // Set the new transport to the client's upstream transport
                this.upstreamTransport = transport
                setInterval(async () => {
                    const stats = await this.upstreamTransport.getStats()
                    for (const report of stats.values()) {
                        // console.log(report.type)
                        // if (report.type === "webrtc-transport") {
                        //     console.log(report.bytesReceived, ' - ', report.rtpBytesReceived)
                        // }
                    }
                }, 1000)
            }
            else { //"consumer"
                // Add the new transport AND the audio/video pid to downstream transport
                this.downstreamTransport.push({
                    transport,
                    associatedAudioPid: audioPid,
                    associatedVideoPid: videoPid
                })
            }
            resolve({ transport, clientTransportParams })
        })
    }

    addProducer(kind, newProducer) {
        this.producer[kind] = newProducer
        if (kind === "audio") {
            // Add this to our activeSpeakerObserver
            this.room.activeSpeakerObserver.addProducer({
                producerId: newProducer.id
            })
        }
    }

    addConsumer(kind, newConsumer, downstreamTransport) {
        downstreamTransport[kind] = newConsumer
    }
}

module.exports = Client;