const createProducer = async (localStream, producerTransport) => {
    return new Promise(async (resolve, reject) => {
        // Get the audio and video tracks so we can produce
        const videoTrack = localStream.getVideoTracks()[0]
        const audioTrack = localStream.getAudioTracks()[0]

        try {
            // running the produce method will tell the transport connect event to fire
            console.log("Produce running on video")
            const videoProducer = await producerTransport.produce({
                track: videoTrack
            })
            console.log("Produce running on audio")
            const audioProducer = await producerTransport.produce({
                track: audioTrack
            })
            console.log("Both produce done")

            resolve({ audioProducer, videoProducer })
        }
        catch (e) {
            console.log("createProducerError: ", e)
        }
    })
}

export default createProducer