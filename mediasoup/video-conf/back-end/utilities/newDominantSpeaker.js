const newDominantSpeaker = (ds, room, io) => {
    console.log("=================================")
    console.log("NEW DOMINANT SPEAKER", ds.producer.id)
    console.log("=================================")
    // look through the room's activeSpeakerList for this procuder's pid
    // we KNOW that it is an audio pid
    const i = room.activeSpeakerList.findIndex(pid => pid === ds.producer.id)
    if (i > -1) {
        // This person is in the list and need to be moved to the front
        const [pid] = room.activeSpeakerList.splice(i, 1)
        room.activeSpeakerList.unshift(pid)
    }
    else {
        // New producer, just add to the front
        room.activeSpeakerList.unshift(ds.producer.id)
    }

    // TODO the aciveSpeakerList has changed
    // updateActiveSpeakers = mute/unmute/get new transports
}

module.exports = newDominantSpeaker;