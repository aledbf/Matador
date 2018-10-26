const _ = require("lodash");

const getActiveKeys = function (queueName) {
  return new Promise((resolve) => {
    queueName = queueName ? queueName : '*';
    redis.keys("bull:" + queueName + ":active", function (err, keys) {
      return resolve(keys);
    });
  });
};

const getCompletedKeys = function (queueName) {
  return new Promise((resolve) => {
    queueName = queueName ? queueName : '*';
    redis.keys("bull:" + queueName + ":completed", function (err, keys) {
      return resolve(keys);
    });
  });
};

const getFailedKeys = function (queueName) {
  return new Promise((resolve) => {
    queueName = queueName ? queueName : '*';
    redis.keys("bull:" + queueName + ":failed", function (err, keys) {
      return resolve(keys);
    });
  });
};

const getWaitingKeys = function (queueName) {
  return new Promise((resolve) => {
    queueName = queueName ? queueName : '*';
    redis.keys("bull:" + queueName + ":wait", function (err, keys) {
      return resolve(keys);
    });
  });
};

const getDelayedKeys = function (queueName) {
  return new Promise((resolve) => {
    queueName = queueName ? queueName : '*';
    redis.keys("bull:" + queueName + ":delayed", function (err, keys) {
      return resolve(keys);
    });
  });
};

const getStuckKeys = () => {
  return new Promise((resolve) => {
    //TODO: Find better way to do this. Being lazy at the moment.
    getAllKeys().then((keys) => {
      formatKeys(keys).then((keyList) => {
        keyList = _.filter(keyList, (key) => {
          return key.status === "stuck";
        });

        let results = {};
        let count = 0;
        for (let i = 0, ii = keyList.length; i < ii; i++) {
          if (!results[keyList[i].type]) results[keyList[i].type] = [];
          results[keyList[i].type].push(keyList[i].id);
          count++;
        }

        return resolve({
          keys: results,
          count: count
        });
      });
    });
  });
};

const getStatus = function (status, queueName) {
  return new Promise((resolve, reject) => {
    let getStatusKeysFunction = null;

    if (status === "complete") {
      getStatusKeysFunction = getCompletedKeys;
    } else if (status === "active") {
      getStatusKeysFunction = getActiveKeys;
    } else if (status === "failed") {
      getStatusKeysFunction = getFailedKeys;
    } else if (status === "wait") {
      getStatusKeysFunction = getWaitingKeys;
    } else if (status === "delayed") {
      getStatusKeysFunction = getDelayedKeys;
    } else if (status === "stuck") {
      return getStuckKeys();
    } else {
      return reject(new Error("UNSUPPORTED STATUS:", status));
    }

    getStatusKeysFunction(queueName).then(function (keys) {
      var multi = [];
      var statusKeys = [];

      for (var i = 0, ii = keys.length; i < ii; i++) {
        var arr = keys[i].split(":");
        var queueName = arr.slice(1, arr.length - 1);
        var queue = queueName.join(":");
        statusKeys[queue] = []; // This creates an array/object thing with keys of the job type
        if (status === "active" || status === "wait") {
          multi.push(['lrange', keys[i], 0, -1]);
        } else if (status === "delayed" || status === "complete" || status === "failed") {
          multi.push(["zrange", keys[i], 0, -1]);
        } else {
          multi.push(["smembers", keys[i]]);
        }
      }

      redis.multi(multi).exec(function (err, data) {
        var statusKeyKeys = Object.keys(statusKeys); // Get the keys from the object we created earlier...
        var count = 0;
        for (var k = 0, kk = data.length; k < kk; k++) {
          statusKeys[statusKeyKeys[k]] = data[k];
          count += data[k].length;
        }

        return resolve({
          keys: statusKeys,
          count: count
        });
      });
    });
  });
};

const getAllKeys = function () {
  return new Promise((resolve) => {
    redis.keys("bull:*:[0-9]*", function (err, keysWithLocks) {
      var keys = [];
      for (var i = 0, ii = keysWithLocks.length; i < ii; i++) {
        var keyWithLock = keysWithLocks[i];
        if (keyWithLock.substring(keyWithLock.length - 5, keyWithLock.length) !== ":lock") {
          keys.push(keyWithLock);
        }
      }
      resolve(keys);
    });
  });
};

const getFullKeyNamesFromIds = function (list) {
  return new Promise((resolve) => {
    if (!list) {
      return resolve();
    }

    if (!(list instanceof Array)) {
      return resolve();
    }

    var keys = [];
    for (var i = 0, ii = list.length; i < ii; i++) {
      keys.push(["keys", "bull:*:" + list[i]]);
    }

    redis.multi(keys).exec(function (err, arrayOfArrays) {
      var results = [];
      for (var i = 0, ii = arrayOfArrays.length; i < ii; i++) {
        if (arrayOfArrays[i].length === 1) {
          results.push(arrayOfArrays[i][0]);
        }
      }

      resolve(results);
    });
  });
}

const getJobsInList = function (list) {
  return new Promise((resolve) => {
    if (!list) {
      return resolve();
    }

    if (list["keys"]) {
      //New list type
      var keys = list["keys"];
      var objectKeys = Object.keys(keys);
      var fullNames = [];
      for (var i = 0, ii = objectKeys.length; i < ii; i++) {
        for (var k = 0, kk = keys[objectKeys[i]].length; k < kk; k++) {
          fullNames.push("bull:" + objectKeys[i] + ":" + keys[objectKeys[i]][k]);
        }
      }

      resolve(fullNames);
    }

    //Old list type
    getFullKeyNamesFromIds(list).then(function (keys) {
      return resolve(keys);
    });
  });
};

const getStatusCounts = () => {
  return new Promise((resolve) => {
    getStatus("active").then((active) => {
      getStatus("complete").then((completed) => {
        getStatus("failed").then((failed) => {
          getStatus("wait").then((pendingKeys) => {
            getStatus("delayed").then((delayedKeys) => {
              getAllKeys().then((allKeys) => {
                redis.keys("bull:*:id", (err, keys) => {
                  var countObject = {
                    active: active.count,
                    complete: completed.count,
                    failed: failed.count,
                    pending: pendingKeys.count,
                    delayed: delayedKeys.count,
                    total: allKeys.length,
                    stuck: allKeys.length - (active.count + completed.count + failed.count + pendingKeys.count + delayedKeys.count),
                    queues: keys.length
                  };

                  return resolve(countObject);
                });
              });
            });
          });
        });
      });
    });
  })
};

const formatKeys = (keys) => {
  return new Promise((resolve) => {
    if (!keys) {
      return resolve();
    }

    getStatus("failed").then((failedJobs) => {
      getStatus("complete").then((completedJobs) => {
        getStatus("active").then((activeJobs) => {
          getStatus("wait").then((pendingJobs) => {
            getStatus("delayed").then((delayedJobs) => {
              let keyList = [];
              for (let i = 0, ii = keys.length; i < ii; i++) {
                let arr = keys[i].split(":");

                let queueName = arr.slice(1, arr.length - 1);
                let queue = queueName.join(":");

                let explodedKeys = {};
                explodedKeys[0] = arr[0];
                explodedKeys[1] = queue;
                explodedKeys[2] = arr[arr.length - 1];

                let status = "stuck";

                if (activeJobs.keys[explodedKeys[1]] && typeof activeJobs.keys[explodedKeys[1]].indexOf === "function" && activeJobs.keys[explodedKeys[1]].indexOf(explodedKeys[2]) !== -1) {
                  status = "active";
                } else if (completedJobs.keys[explodedKeys[1]] && typeof completedJobs.keys[explodedKeys[1]].indexOf === "function" && completedJobs.keys[explodedKeys[1]].indexOf(explodedKeys[2]) !== -1) {
                  status = "complete";
                } else if (failedJobs.keys[explodedKeys[1]] && typeof failedJobs.keys[explodedKeys[1]].indexOf === "function" && failedJobs.keys[explodedKeys[1]].indexOf(explodedKeys[2]) !== -1) {
                  status = "failed";
                } else if (pendingJobs.keys[explodedKeys[1]] && typeof pendingJobs.keys[explodedKeys[1]].indexOf === "function" && pendingJobs.keys[explodedKeys[1]].indexOf(explodedKeys[2]) !== -1) {
                  status = "pending";
                } else if (delayedJobs.keys[explodedKeys[1]] && typeof delayedJobs.keys[explodedKeys[1]].indexOf === "function" && delayedJobs.keys[explodedKeys[1]].indexOf(explodedKeys[2]) !== -1) {
                  status = "delayed";
                }

                keyList.push({
                  id: explodedKeys[2],
                  type: explodedKeys[1],
                  status: status
                });
              }

              keyList = _.sortBy(keyList, (key) => {
                return parseInt(key.id);
              });

              resolve(keyList);
            });
          });
        });
      });
    });
  });
};

const removeJobs = function (list) {
  if (!list) return;
  //Expects {id: 123, type: "video transcoding"}

  var multi = [];
  for (var i = 0, ii = list.length; i < ii; i++) {
    var firstPartOfKey = "bull:" + list[i].type + ":";
    multi.push(["del", firstPartOfKey + list[i].id]);
    multi.push(["lrem", firstPartOfKey + "active", 0, list[i].id]);
    multi.push(["lrem", firstPartOfKey + "wait", 0, list[i].id]);
    multi.push(["zrem", firstPartOfKey + "completed", list[i].id]);
    multi.push(["zrem", firstPartOfKey + "failed", list[i].id]);
    multi.push(["zrem", firstPartOfKey + "delayed", list[i].id]);

  }
  redis.multi(multi).exec();
};

const makePendingByType = function (type) {
  return new Promise((resolve) => {
    type = type.toLowerCase();
    var validTypes = ['active', 'complete', 'failed', 'wait', 'delayed']; //I could add stuck, but I won't support mass modifying "stuck" jobs because it's very possible for things to be in a "stuck" state temporarily, while transitioning between states


    if (validTypes.indexOf(type) === -1) {
      return resolve({
        success: false,
        message: "Invalid type: " + type + " not in list of supported types"
      });
    }

    getStatus(type).then(function (allKeys) {
      var multi = [];
      var allKeyObjects = Object.keys(allKeys.keys);
      for (var i = 0, ii = allKeyObjects.length; i < ii; i++) {
        var firstPartOfKey = "bull:" + allKeyObjects[i] + ":";
        for (var k = 0, kk = allKeys.keys[allKeyObjects[i]].length; k < kk; k++) {
          var item = allKeys.keys[allKeyObjects[i]][k];
          //Brute force remove from everything
          multi.push(["lrem", firstPartOfKey + "active", 0, item]);
          multi.push(["zrem", firstPartOfKey + "completed", item]);
          multi.push(["zrem", firstPartOfKey + "failed", item]);
          multi.push(["zrem", firstPartOfKey + "delayed", item]);
          //Add to pending
          multi.push(["rpush", firstPartOfKey + "wait", item]);
        }
      }

      redis.multi(multi).exec(function (err, data) {
        if (err) {
          return resolve({
            success: false,
            message: err
          });
        }

        return resolve({
          success: true,
          message: "Successfully made all " + type + " jobs pending."
        });
      });
    });
  });
};

var makePendingById = function (type, id) {
  return new Promise((resolve) => {
    if (!id) {
      return resolve({
        success: false,
        message: "There was no ID provided."
      });
    }

    if (!type) {
      return resolve({
        success: false,
        message: "There was no type provided."
      });
    }

    var firstPartOfKey = "bull:" + type + ":";
    var multi = [];
    multi.push(["lrem", firstPartOfKey + "active", 0, id]);
    multi.push(["lrem", firstPartOfKey + "wait", 0, id]);
    multi.push(["zrem", firstPartOfKey + "completed", id]);
    multi.push(["zrem", firstPartOfKey + "failed", id]);
    multi.push(["zrem", firstPartOfKey + "delayed", id]);
    //Add to pending
    multi.push(["rpush", firstPartOfKey + "wait", id]);
    redis.multi(multi).exec(function (err, data) {
      if (err) {
        return resolve({
          success: false,
          message: err
        });
      }

      return resolve({
        success: true,
        message: "Successfully made " + type + " job #" + id + " pending."
      });
    });
  });
};

const deleteJobByStatus = function (type, queueName) {
  return new Promise((resolve) => {
    type = type.toLowerCase();
    var validTypes = ['active', 'complete', 'failed', 'wait', 'delayed']; //I could add stuck, but I won't support mass modifying "stuck" jobs because it's very possible for things to be in a "stuck" state temporarily, while transitioning between states

    if (validTypes.indexOf(type) === -1) {
      return resolve({
        success: false,
        message: "Invalid type: " + type + " not in list of supported types"
      });
    }
    getStatus(type, queueName).then(function (allKeys) {
      var multi = [];
      var allKeyObjects = Object.keys(allKeys.keys);
      for (var i = 0, ii = allKeyObjects.length; i < ii; i++) {
        var firstPartOfKey = "bull:" + allKeyObjects[i] + ":";
        for (var k = 0, kk = allKeys.keys[allKeyObjects[i]].length; k < kk; k++) {
          var item = allKeys.keys[allKeyObjects[i]][k];
          //Brute force remove from everything
          multi.push(["lrem", firstPartOfKey + "active", 0, item]);
          multi.push(["lrem", firstPartOfKey + "wait", 0, item]);
          multi.push(["zrem", firstPartOfKey + "completed", item]);
          multi.push(["zrem", firstPartOfKey + "failed", item]);
          multi.push(["zrem", firstPartOfKey + "delayed", item]);
          multi.push(["del", firstPartOfKey + item]);
        }
      }

      redis.multi(multi).exec(function (err, data) {
        if (err) {
          return resolve({
            success: false,
            message: err
          });
        }

        if (queueName) {
          return resolve({
            success: true,
            message: "Successfully deleted all jobs of status " + type + " of queue " + queueName + "."
          });
        }

        return resolve({
          success: true,
          message: "Successfully deleted all jobs of status " + type + "."
        });
      });
    });
  });
};

var deleteJobById = function (type, id) {
  return new Promise((resolve) => {
    if (!id) {
      return resolve({
        success: false,
        message: "There was no ID provided."
      });
    }

    if (!type) {
      return resolve({
        success: false,
        message: "There was no type provided."
      });
    }

    var firstPartOfKey = "bull:" + type + ":";

    var multi = [];
    multi.push(["lrem", firstPartOfKey + "active", 0, id]);
    multi.push(["lrem", firstPartOfKey + "wait", 0, id]);
    multi.push(["zrem", firstPartOfKey + "completed", id]);
    multi.push(["zrem", firstPartOfKey + "failed", id]);
    multi.push(["zrem", firstPartOfKey + "delayed", id]);
    multi.push(["del", firstPartOfKey + id]);

    redis.multi(multi).exec(function (err, data) {
      if (err) {
        return resolve({
          success: false,
          message: err
        });
      }

      return resolve({
        success: true,
        message: "Successfully deleted job " + type + " #" + id + "."
      });
    });
  });
};

var getDataById = function (type, id) {
  return new Promise((resolve) => {
    if (!id) {
      return resolve({
        success: false,
        message: "There was no ID provided."
      });
    }

    if (!type) {
      return resolve({
        success: false,
        message: "There was no type provided."
      });
    }

    var firstPartOfKey = "bull:" + type + ":";
    redis.hgetall(firstPartOfKey + id, function (err, data) {
      if (err) {
        return resolve({
          success: false,
          message: err
        });
      }

      return resolve({
        success: true,
        message: data
      });
    });
  });
};

var getProgressForKeys = function (keys) {
  return new Promise((resolve) => {
    var multi = [];
    for (var i = 0, ii = keys.length; i < ii; i++) {
      multi.push(["hget", "bull:" + keys[i].type + ":" + keys[i].id, "progress"]);
    }

    redis.multi(multi).exec(function (err, results) {
      for (var i = 0, ii = keys.length; i < ii; i++) {
        keys[i].progress = results[i];
      }
      resolve(keys);
    });
  });
};

var getDelayTimeForKeys = function (keys) {
  return new Promise((resolve) => {
    var multi = [];
    for (var i = 0, ii = keys.length; i < ii; i++) {
      multi.push(["zscore", "bull:" + keys[i].type + ":delayed", keys[i].id]);
    }

    redis.multi(multi).exec(function (err, results) {
      for (var i = 0, ii = keys.length; i < ii; i++) {
        // Bull packs delay expire timestamp and job id into a single number. This is mostly
        // needed to preserve execution order – first part of the resulting number contains
        // the timestamp and the end contains the incrementing job id. We don't care about
        // the id, so we can just remove this part from the value.
        // https://github.com/OptimalBits/bull/blob/e38b2d70de1892a2c7f45a1fed243e76fd91cfd2/lib/scripts.js#L90
        keys[i].delayUntil = new Date(Math.floor(results[i] / 0x1000));
      }
      return resolve(keys);
    });
  });
};

const getQueues = () => {
  return new Promise((resolve) => {
    redis.keys("bull:*:id").then((queues) => {
      return Promise.all(queues.map(async (queue) => {
        let name = queue.substring(0, queue.length - 3);
        let activeJobs = await redis.lrange(name + ":active", 0, -1);
        let active = activeJobs.filter((job) => {
          return redis.get(name + ":" + job + ":lock").then((lock) => {
            return lock != null;
          });
        });
        let stalled = activeJobs.filter((job) => {
          return redis.get(name + ":" + job + ":lock").then((lock) => {
            return lock == null;
          });
        });

        let pending = await redis.llen(name + ":wait");
        let delayed = await redis.zcard(name + ":delayed");
        let completed = await redis.zcount(name + ":completed", '-inf', '+inf');
        let failed = await redis.zcount(name + ":failed", '-inf', '+inf');

        return Promise.join(active, stalled, pending, delayed, completed, failed, (active, stalled, pending, delayed, completed, failed) => {
          return {
            name: name.substring(5),
            active: active.length,
            stalled: stalled.length,
            pending: pending,
            delayed: delayed,
            completed: completed,
            failed: failed
          };
        });
      }));
    }).then(resolve);
  });
};

module.exports.getAllKeys = getAllKeys; //Returns all JOB keys in string form (ex: bull:video transcoding:101)
module.exports.formatKeys = formatKeys; //Returns all keys in object form, with status applied to object. Ex: {id: 101, type: "video transcoding", status: "pending"}
module.exports.getStatus = getStatus; //Returns indexes of completed jobs
module.exports.getStatusCounts = getStatusCounts; //Returns counts for different statuses
module.exports.getJobsInList = getJobsInList; //Returns the job data from a list of job ids
module.exports.getDataById = getDataById; //Returns the job's data based on type and ID
module.exports.removeJobs = removeJobs; //Removes one or  more jobs by ID, also removes the job from any state list it's in
module.exports.makePendingByType = makePendingByType; //Makes all jobs in a specific status pending
module.exports.makePendingById = makePendingById; //Makes a job with a specific ID pending, requires the type of job as the first parameter and ID as second.
module.exports.deleteJobByStatus = deleteJobByStatus; //Deletes all jobs in a specific status
module.exports.deleteJobById = deleteJobById; //Deletes a job by ID. Requires type as the first parameter and ID as the second.
module.exports.getProgressForKeys = getProgressForKeys; //Gets the progress for the keys passed in
module.exports.getDelayTimeForKeys = getDelayTimeForKeys; // Gets the delay end time for the keys passed in
module.exports.getQueues = getQueues //Get information about all the queues in the redis instance