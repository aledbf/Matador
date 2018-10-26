const redisModel = require('../models/redis');

module.exports = (app) => {
    const getFailedData = (req, res) => {
        return new Promise((resolve) => {
            redisModel.getStatus("failed").done((failed) => {
                redisModel.getJobsInList(failed).done((keys) => {
                    redisModel.formatKeys(keys).done((keyList) => {
                        redisModel.getStatusCounts().done((countObject) => {
                            const model = {
                                keys: keyList,
                                counts: countObject,
                                failed: true,
                                type: "Failed"
                            };

                            resolve(model);
                        });
                    });
                });
            });
        });
    }

    app.get('/failed', (req, res) => {
        getFailedData(req, res).then((model) => {
            res.render('jobList', model);
        });
    });

    app.get('/api/failed', (req, res) => {
        getFailedData(req, res).then((model) => {
            res.json(model);
        });
    });
};