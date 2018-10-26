module.exports = exports = (options) => {
    options = options || {};
    return (req, res, next) => {
        if (!redis.status === 'ready') {
            if (req.xhr) {
                return res.json({
                    success: false,
                    message: "Not connected to redis database."
                });
            }
            console.log(redis)
            return res.render(options.errorPages["not-connected"]);
        }

        return next();
    };
};