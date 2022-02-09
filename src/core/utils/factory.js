import util from 'util';
import redis from 'redis';
import { config } from '../config';

const factory = {};
module.exports = factory;

factory.getRedisClient = function () {
    const client = redis.createClient(config.redis);
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
