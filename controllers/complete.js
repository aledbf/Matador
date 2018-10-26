const redisModel = require('../models/redis');

module.exports = (app) => {
    const requestComplete = (req, res) => {
        return new Promise((resolve) => {
            redisModel.getStatus("complete").then((completed) => {
                redisModel.getJobsInList(completed).then((keys) => {
                    redisModel.formatKeys(keys).then((keyList) => {
                        redisModel.getStatusCounts().then((countObject) => {
                            var model = {
                                keys: keyList,
                                counts: countObject,
                                complete: true,
                                type: "Complete"
                            };

                            resolve(model);
                        });
                    });
                });
            });
        });
    };

    app.get('/complete', (req, res) => {
        requestComplete(req, res).then((model) => {
            res.render('jobList', model);
        });
    });

    app.get('/api/complete', (req, res) => {
        requestComplete(req, res).then((model) => {
            res.json(model);
        });
    });
};