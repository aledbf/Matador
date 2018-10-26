const redisModel = require('../models/redis');

module.exports = (app) => {
    var requestActive = (req, res) => {
        return new Promise((resolve) => {
            redisModel.getStatus("active").done((active) => {
                redisModel.getJobsInList(active).done((keys) => {
                    redisModel.formatKeys(keys).done((formattedKeys) => {
                        redisModel.getProgressForKeys(formattedKeys).done((keyList) => {
                            redisModel.getStatusCounts().done((countObject) => {
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