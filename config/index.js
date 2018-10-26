module.exports = () => {
  const env = process.env.NODE_ENV ?
    process.env.NODE_ENV.toLowerCase() : "development";

  let redis = {};

  if (process.env.REDIS_SENTINEL) {
    redis = {
      enableReadyCheck: true,
      name: 'mymaster',
      sentinels: [{
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT),
      }]
    };
  } else {
    redis = {
      enableReadyCheck: true,
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    };
  }

  const cfg = {
    "port": process.env.PORT || 1337,
    "errorPages": {
      "404": "errors/404",
      "not-connected": "errors/not-connected"
    },
    redis,
  }

  cfg[env] = true;

  return cfg;
}