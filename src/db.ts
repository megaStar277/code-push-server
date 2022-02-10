#!/usr/bin/env node

/**
 * Module dependencies.
 */
import fs from 'fs';
import path from 'path';
import _ from 'lodash';
import mysql from 'mysql2';
import yargs from 'yargs';
import { CURRENT_DB_VERSION } from './core/const';

var argv = yargs
    .usage('Usage: $0 <command> [options]')
    .command('init', '初始化数据库', {
        dbpassword: {
            alias: 'dbpassword',
            type: 'string',
        },
    })
    .command('upgrade', '升级数据库', {
        dbpassword: {
            alias: 'dbpassword',
            type: 'string',
        },
    })
    .example(
        '$0 init --dbname codepush --dbhost localhost --dbuser root --dbpassword 123456 --dbport 3306 --force',
        '初始化code-push-server数据库',
    )
    .example(
        '$0 upgrade --dbname codepush --dbhost localhost --dbuser root --dbpassword 123456 --dbport 3306',
        '升级code-push-server数据库',
    )
    .default({
        dbname: 'codepush',
        dbhost: 'localhost',
        dbuser: 'root',
        dbpassword: null,
    })
    .help('h')
    .alias('h', 'help')
    .parseSync();

var command = argv._[0];
var dbname = argv.dbname ? argv.dbname : 'codepush';
var dbhost = argv.dbhost ? argv.dbhost : 'localhost';
var dbuser = argv.dbuser ? argv.dbuser : 'root';
var dbport = argv.dbport ? argv.dbport : 3306;
var dbpassword = argv.dbpassword;

if (command === 'init') {
    var connection2;
    var connection = mysql
        .createConnection({
            host: dbhost,
            user: dbuser,
            password: dbpassword,
            port: dbport,
        })
        .promise();
    var createDatabaseSql = argv.force
        ? `CREATE DATABASE IF NOT EXISTS ${dbname}`
        : `CREATE DATABASE ${dbname}`;
    connection.connect();
    connection
        .query(createDatabaseSql)
        .then(function () {
            connection2 = mysql
                .createConnection({
                    host: dbhost,
                    user: dbuser,
                    password: dbpassword,
                    database: dbname,
                    multipleStatements: true,
                    port: dbport,
                })
                .promise();
            connection2.connect();
            return connection2;
        })
        .then(function (connection2) {
            var sql = fs.readFileSync(path.resolve(__dirname, '../sql/codepush-all.sql'), 'utf-8');
            return connection2.query(sql);
        })
        .then(function () {
            console.log('success.');
        })
        .catch(function (e) {
            console.log(e);
        })
        .finally(function () {
            if (connection) connection.end();
            if (connection2) connection2.end();
        });
} else if (command == 'upgrade') {
    try {
        var connection = mysql
            .createConnection({
                host: dbhost,
                user: dbuser,
                password: dbpassword,
                database: dbname,
                multipleStatements: true,
                port: dbport,
            })
            .promise();
        connection.connect();
    } catch (e) {
        console.error('connect mysql error, check params', e);
        process.exit(1);
    }

    var version_no = '0.0.1';
    connection
        .query('select `version` from `versions` where `type`=1 limit 1')
        .then((rs) => {
            version_no = _.get(rs, '0.version', '0.0.1');
            if (version_no == CURRENT_DB_VERSION) {
                console.log('Everything up-to-date.');
                process.exit(0);
            }
            var allSqlFile = [
                {
                    version: '0.2.14',
                    path: path.resolve(__dirname, '../sql/codepush-v0.2.14-patch.sql'),
                },
                {
                    version: '0.2.15',
                    path: path.resolve(__dirname, '../sql/codepush-v0.2.15-patch.sql'),
                },
                {
                    version: '0.3.0',
                    path: path.resolve(__dirname, '../sql/codepush-v0.3.0-patch.sql'),
                },
                {
                    version: '0.4.0',
                    path: path.resolve(__dirname, '../sql/codepush-v0.4.0-patch.sql'),
                },
                {
                    version: '0.5.0',
                    path: path.resolve(__dirname, '../sql/codepush-v0.5.0-patch.sql'),
                },
            ];
            return allSqlFile.reduce((prev, sqlFile) => {
                if (!_.gt(sqlFile['version'], version_no)) {
                    return prev;
                }
                var sql = fs.readFileSync(sqlFile['path'], 'utf-8');
                console.log('exec sql file:' + sqlFile['path']);
                return connection.query(sql).then(() => {
                    console.log('success exec sql file:' + sqlFile['path']);
                });
            }, Promise.resolve());
        })
        .then(function () {
            console.log('Upgrade success.');
        })
        .catch(function (e) {
            console.error(e);
        })
        .finally(function () {
            if (connection) connection.end();
        });
} else {
    yargs.showHelp();
}
