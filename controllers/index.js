const redisModel = require('../models/redis');
const _ = require('lodash');
const updateInfo = require('../lib/updateInfo.js');

module.exports = (app) => {
    var getOverviewData = (req, res) => {
        return new Promise((resolve) => {
            redisModel.getAllKeys().done((keys) => {
                redisModel.formatKeys(keys).done((keyList) => {
                    redisModel.getStatusCounts().done((countObject) => {
                        updateInfo.getMemoryUsage().done((memoryUsage) => {
                            if (countObject.stuck == 0) keyList = [];
                            else keyList = _.filter(keyList, (key) => {
                                return key.status === "stuck";
                            });
                            const usage = [];
                            for (var time in memoryUsage.usage) {
                                usage.push({
                                    time: time,
                                    memory: memoryUsage.usage[time]
                                });
                            }
                            memoryUsage.usage = usage;
                            const model = {
                                keys: keyList,
                                counts: countObject,
                                overview: true,
                                memory: memoryUsage
                            };

                            resolve(model);
                        });
                    });
                });
            });
        });
    }

    app.get('/', (req, res) => {
        getOverviewData(req, res).then((model) => {
            res.render('index', model);
        });
    });

    app.get('/api/', (req, res) => {
        getOverviewData(req, res).then((model) => {
            res.json(model);
        });
    });
};