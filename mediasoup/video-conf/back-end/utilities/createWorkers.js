const os = require("os")
const mediasoup = require("mediasoup")

const config = require("../config/config")


const totalThreads = os.cpus().length //Maximum number of workers, one thread per worker

const createWorkers = async () => new Promise(async (resolve, reject) => {
    let workers = []
    // Loop to create each worker
    for (let i = 0; i < totalThreads; i++) {
        const worker = await mediasoup.createWorker({
            // Ports for traffic, don't forget to configure firewall and networking rules
            rtcMinPort: config.workerSettings.rtcMinPort,
            rtcMaxPort: config.workerSettings.rtcMaxPort,
            logLevel: config.workerSettings.logLevel,
            logTags: config.workerSettings.logTags
        });

        worker.on('died', () => {
            console.error('mediasoup worker died, exiting in 2 seconds... [pid:%d]', worker.pid);
            setTimeout(() => process.exit(1), 2000);
        });

        workers.push(worker)
    }

    resolve(workers)
})

module.exports = createWorkers;