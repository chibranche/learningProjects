// In src/controllers/workoutController.js
const recordService = require("../services/recordService");

const getRecordForWorkout = (req, res) => {
    try {
        const recordService = recordService.getRecordForWorkout();
        res.send({ status: "OK", data: recordService });
    } catch (error) {
        res
            .status(error?.status || 500)
            .send({ status: "FAILED", data: { error: error?.message || error } });
    }
};

module.exports = {
    getRecordForWorkout,
};