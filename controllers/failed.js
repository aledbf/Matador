const redisModel = require('../models/redis');

module.exports = (app) => {
    const getFailedData = (req, res) => {
        return new Promise((resolve) => {
            redisModel.getStatus("failed").then((failed) => {
                redisModel.getJobsInList(failed).then((keys) => {
                    redisModel.formatKeys(keys).then((keyList) => {
                        redisModel.getStatusCounts().then((countObject) => {
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