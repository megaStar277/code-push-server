'use strict';
const util = require('util');
const redis = require('redis');
const config = require('../config');
const _ = require('lodash');

const factory = {};
module.exports = factory;

factory.getRedisClient = function () {
    const client = redis.createClient(_.get(config, 'redis'));
    return {
        del: util.promisify(client.del).bind(client),
        exists: util.promisify(client.exists).bind(client),
        expire: util.promisify(client.expire).bind(client),
        get: util.promisify(client.get).bind(client),
        incr: util.promisify(client.incr).bind(client),
        keys: util.promisify(client.keys).bind(client),
        quit: util.promisify(client.quit).bind(client),
        setex: util.promisify(client.setex).bind(client),
        ttl: util.promisify(client.ttl).bind(client),
    };
};
