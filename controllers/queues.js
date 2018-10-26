const redisModel = require('../models/redis');

module.exports = (app) => {
    var getQueuesModel = (req, res) => {
        return new Promise((resolve) => {
            redisModel.getQueues().done((queues) => {
                redisModel.getStatusCounts().done((countObject) => {
                    var model = {
                        keys: queues,
                        counts: countObject,
                        queues: true,
                        type: "Queues"
                    };

                    resolve(model);
                });
            });
        });
    };

    app.get('/queues', (req, res) => {
        getQueuesModel(req, res).then((model) => {
            res.render('queueList', model);
        });
    });

    app.get('/api/queues', (req, res) => {
        getQueuesModel(req, res).then((model) => {
            res.json(model);
        });
    });
};