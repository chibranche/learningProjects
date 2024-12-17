const config = require('../config/config')
const newDominantSpeaker = require('../utilities/newDominantSpeaker')

// NOTE:
// Rooms are not a MediaSoup thing. MS cares about mediastreams, transports
// things like that. It does not care or know about rooms
// Rooms can be inside clients, clients inside rooms
// Transports can belong to rooms or clients, etc

class Room {
    constructor(roomName, workerToUse) {
        this.roomName = roomName
        this.worker = workerToUse
        this.router = null
        // All the Clients objects that are in this room
        this.clients = []
        // An array of ids with the most recent dominent speaker firts
        this.activeSpeakerList = []
    }

    addClient(client) {
        this.clients.push(client)
    }

    async createRouter(io) {
        return new Promise(async (resolve, reject) => {
            this.router = await this.worker.createRouter({
                mediaCodecs: config.routerMediaCodecs
            })
            this.activeSpeakerObserver = await this.router.createActiveSpeakerObserver({
                interval: 300, //Default: 300
            })
            // CAREFULL ! this fails silently
            this.activeSpeakerObserver.on('dominantspeaker', ds => newDominantSpeaker(ds, this, io)) //this: the room
            resolve()
        })
    }
}

module.exports = Room;