const redisModel = require('../models/redis');

module.exports = (app) => {
    var requestActive = (req, res) => {
        return new Promise((resolve) => {
            redisModel.getStatus("active").then((active) => {
                redisModel.getJobsInList(active).then((keys) => {
                    redisModel.formatKeys(keys).then((formattedKeys) => {
                        redisModel.getProgressForKeys(formattedKeys).then((keyList) => {
                            redisModel.getStatusCounts().then((countObject) => {
                                const model = {
                                    keys: keyList,
                                    counts: countObject,
                                    active: true,
                                    type: "Active"
                                };
                                resolve(model);
                            });
                        });
                    });
                });
            });
        });
    }

    app.get('/active', (req, res) => {
        requestActive(req, res).then((model) => {
            res.render('jobList', model);
        });
    });

    app.get('/api/active', (req, res) => {
        requestActive(req, res).then((model) => {
            res.json(model);
        });
    });
};