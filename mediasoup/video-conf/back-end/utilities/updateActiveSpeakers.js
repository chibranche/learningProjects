const updateActiveSpeakers = (room, io) => {
    // This function is called on newDominantSpeaker, or when a new peer produces
    // Mutes exsting consumers/producers if below 5, for all peers in room
    // Unmutes existing consumers/producers in the top 5 for all peers in room
    // Return new transports by peer
    // Called by either activeSpeakerObserver (newDominantSpeaker) or startProducing (new speaker)

    const activeSpeakers = room.activeSpeakerList.slice(0, 5) //Make a transport for each
    const mutedSpeakers = room.activeSpeakerList.slice(5) //Mute or pause
    const newTransportsByPeer = {}

    // Loop through all connected clients in the room
    room.clients.forEach(client => {
        // Loop through all clients to mute
        mutedSpeakers.forEach(pid => {
            // pid: producer id we want to mute
            if (client?.producer?.audio?.id === pid) { //Search for the producer
                client?.producer?.audio?.pause()
                client?.producer?.video?.pause()
                return
            }
            const downstreamToStop = client.downstreamTransport.find(t => t?.audio?.producerId === pid)
            if (downstreamToStop) {
                downstreamToStop.audio.pause()
                downstreamToStop.video.pause()
            }
        })

        const newSpeakersToThisClient = [] //Store all the pids the client is not yet consuming
        activeSpeakers.forEach(pid => {
            if (client?.producer?.audio?.id === pid) {
                client?.producer?.audio?.resume()
                client?.producer?.video?.resume()
                return
            }
            // Can grab pid from the audio.producerId like above, or use our own associatedAudioPid
            const downstreamToStart = client.downstreamTransport.find(t => t?.audio?.producerId === pid)
            if (downstreamToStart) {
                downstreamToStart.audio.resume()
                downstreamToStart.video.resume()
            }
            else {
                // This client is not consuming, start the process
                newSpeakersToThisClient.push(pid)
            }
        })

        if (newSpeakersToThisClient.length > 0) {
            // This client has at least 1 new transport/consumer to make 
            // at socket.id key, put array of newSpeakers to make
            // If there were no newSpeakers, then there will be no key for that client
            newTransportsByPeer[client.socket.id] = newSpeakersToThisClient
        }
    })

    // Client loop is done, we have muter/unmuted all producers/consumers based on the new activeSpeakerList. 
    // Now send out the consumers that need to be made
    io.to(room.roomName).emit("updateActiveSpeakers", activeSpeakers) //Broadcast to this room (all clients)

    return (newTransportsByPeer)
}

module.exports = updateActiveSpeakers;