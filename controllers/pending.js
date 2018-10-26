const redisModel = require('../models/redis');

module.exports = function (app) {
    var getPendingModel = function (req, res) {
        return new Promise((resolve) => {
            redisModel.getStatus("wait").done(function (active) {
                redisModel.getJobsInList(active).done(function (keys) {
                    redisModel.formatKeys(keys).done(function (keyList) {
                        redisModel.getStatusCounts().done(function (countObject) {
                            var model = {
                                keys: keyList,
                                counts: countObject,
                                pending: true,
                                type: "Pending"
                            };

                            resolve(model);
                        });
                    });
                });
            });
        });
    };

    app.get('/pending', function (req, res) {
        getPendingModel(req, res).then(function (model) {
            res.render('jobList', model);
        });
    });

    app.get('/api/pending', function (req, res) {
        getPendingModel(req, res).then(function (model) {
            res.json(model);
        });
    });
};