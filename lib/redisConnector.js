const redisAdapter = require('ioredis');
const updateInfo = require('./updateInfo');

exports.connect = function (settings) {
    redis = redisAdapter.createClient(settings);
    if (settings.password) {
        redis.auth(settings.password);
    }
    redis.on("error", console.log);
    updateInfo.startUpdatingInfo();
};