const _ = require("lodash");
const Queue = require('bull');

const createQueue = _.memoize(
  (queue, port, host, password, options) => {
    return Queue(queue, {
      redis: {
        port: port,
        host: host,
        password: password,
        opts: options
      }
    });
  },
  (queue, port, host, options) => {
    return queue;
  }
);

const createJob = (redisOptions, queueName, payload) => {
  const queue = createQueue(queueName, redisOptions.port, redisOptions.host, redisOptions.password, redisOptions.options || {});
  return queue.add(payload);
};

module.exports.createJob = createJob;