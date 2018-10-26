const redisModel = require('../models/redis');

module.exports = function (app) {
    const getNewJobModel = function (req, res) {
        return new Promise((resolve) => {
            redisModel.getStatusCounts().then(function (countObject) {
                var model = {
                    counts: countObject,
                    newjob: true,
                    type: "New Job"
                };

                resolve(model);
            });
        })
    };

    app.get('/newjob', function (req, res) {
        getNewJobModel(req, res).then(function (model) {
            res.render('newJob', model);
        });
    });

    app.get('/api/newjob', function (req, res) {
        getNewJobModel(req, res).then(function (model) {
            res.json(model);
        });
    });
};