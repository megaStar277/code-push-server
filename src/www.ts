#!/usr/bin/env node

/**
 * Module dependencies.
 */

import { logger } from 'kv-logger';
import http from 'http';
import validator from 'validator';
import _ from 'lodash';

import { app } from './app';
import { Versions } from './models/versions';

var constConfig = require('./core/const');

/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(process.env.PORT || '3000');

var host = null;
if (process.env.HOST) {
    logger.debug('process.env.HOST ' + process.env.HOST);
    if (validator.isIP(process.env.HOST)) {
        logger.debug(process.env.HOST + ' valid');
        host = process.env.HOST;
    } else {
        logger.warn('process.env.HOST ' + process.env.HOST + ' is invalid, use 0.0.0.0 instead');
    }
}
app.set('port', port);

/**
 * Create HTTP server.
 */

const server = http.createServer(app);

/**
 * Listen on provided port, on all network interfaces.
 */
Versions.findOne({ where: { type: 1 } })
    .then(function (v) {
        if (!v || v.get('version') != constConfig.CURRENT_DB_VERSION) {
            throw new Error(
                'Please upgrade your database. use `npm run upgrade` or `code-push-server-db upgrade`',
            );
        }
        server.listen(port, host);
        server.on('error', onError);
        server.on('listening', onListening);
        return;
    })
    .catch(function (e) {
        if (_.startsWith(e.message, 'ER_NO_SUCH_TABLE')) {
            logger.error(
                new Error(
                    'Please upgrade your database. use `npm run upgrade` or `code-push-server-db upgrade`',
                ),
            );
        } else {
            logger.error(e);
        }
        process.exit(1);
    });

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val): number | string | boolean {
    var port = parseInt(val, 10);

    if (isNaN(port)) {
        // named pipe
        return val;
    }

    if (port >= 0) {
        // port number
        return port;
    }

    return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
    if (error.syscall !== 'listen') {
        throw error;
    }

    var bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            logger.error(bind + ' requires elevated privileges');
            process.exit(1);
            break;
        case 'EADDRINUSE':
            logger.error(bind + ' is already in use');
            process.exit(1);
            break;
        default:
            throw error;
    }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
    var addr = server.address();
    logger.info('server is listening on ', addr);
}
