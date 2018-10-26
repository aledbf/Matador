'use strict';

const bullModel = require('../models/bull');
const redisModel = require('../models/redis');

module.exports = (app) => {
    app.get('/api/jobs/pending/status/:type', (req, res) => {
        var type = req.params['type'];
        redisModel.makePendingByType(type).then((results) => {
            res.json(results);
        });
    });

    app.get('/api/jobs/pending/id/:type/:id', (req, res) => {
        var id = req.params['id'],
            type = req.params['type'];
        redisModel.makePendingById(type, id).then((results) => {
            res.json(results);
        });
    });

    app.get('/api/jobs/delete/status/:type', (req, res) => {
        var type = req.params['type'];
        var queueName = req.params['queueName'] ? req.params['queueName'] : null;
        redisModel.deleteJobByStatus(type, queueName).then((results) => {
            res.json(results);
        });
    });

    app.get('/api/jobs/delete/id/:type/:id', (req, res) => {
        var id = req.params['id'],
            type = req.params['type'];
        redisModel.deleteJobById(type, id).then((results) => {
            res.json(results);
        });
    });

    app.get('/api/jobs/info/:type/:id', (req, res) => {
        var id = req.params['id'],
            type = req.params['type'];
        redisModel.getDataById(type, id).then((results) => {
            res.json(results);
        });
    });

    app.post('/api/jobs/create', (req, res) => {
        var error;
        var payloadObject;
        var queue = req.body && req.body.queue;

        if (!queue) {
            error = 'No queue specified';
        }

        if (!error) {
            try {
                payloadObject = JSON.parse(req.body.payload);
            } catch (e) {
                error = 'Invalid JSON';
            }
        }

        if (error) {
            return res.status(400).send(error);
        }

        bullModel.createJob(req.app.locals.options.redis, queue, payloadObject)
            .then(() => {
                return res.status(200).send('OK');
            });
    });
};