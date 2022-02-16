import fs from 'fs';
import fsextra from 'fs-extra';
import extract from 'extract-zip';
import _ from 'lodash';
import validator from 'validator';
import util from 'util';
import fetch from 'node-fetch';
import { logger } from 'kv-logger';

import { config } from '../config';
import { AppError } from '../app-error';

const streamPipeline = util.promisify(require('stream').pipeline);

var common = {};
module.exports = common;

common.parseVersion = function (versionNo) {
    var version = '0';
    var data = null;
    if ((data = versionNo.match(/^([0-9]{1,3}).([0-9]{1,5}).([0-9]{1,10})$/))) {
        // "1.2.3"
        version = data[1] + _.padStart(data[2], 5, '0') + _.padStart(data[3], 10, '0');
    } else if ((data = versionNo.match(/^([0-9]{1,3}).([0-9]{1,5})$/))) {
        // "1.2"
        version = data[1] + _.padStart(data[2], 5, '0') + _.padStart('0', 10, '0');
    }
    return version;
};

common.validatorVersion = function (versionNo) {
    var flag = false;
    var min = '0';
    var max = '9999999999999999999';
    var data = null;
    if (versionNo == '*') {
        // "*"
        flag = true;
    } else if ((data = versionNo.match(/^([0-9]{1,3}).([0-9]{1,5}).([0-9]{1,10})$/))) {
        // "1.2.3"
        flag = true;
        min = data[1] + _.padStart(data[2], 5, '0') + _.padStart(data[3], 10, '0');
        max = data[1] + _.padStart(data[2], 5, '0') + _.padStart(parseInt(data[3]) + 1, 10, '0');
    } else if ((data = versionNo.match(/^([0-9]{1,3}).([0-9]{1,5})(\.\*){0,1}$/))) {
        // "1.2" "1.2.*"
        flag = true;
        min = data[1] + _.padStart(data[2], 5, '0') + _.padStart('0', 10, '0');
        max = data[1] + _.padStart(parseInt(data[2]) + 1, 5, '0') + _.padStart('0', 10, '0');
    } else if ((data = versionNo.match(/^\~([0-9]{1,3}).([0-9]{1,5}).([0-9]{1,10})$/))) {
        //"~1.2.3"
        flag = true;
        min = data[1] + _.padStart(data[2], 5, '0') + _.padStart(data[3], 10, '0');
        max = data[1] + _.padStart(parseInt(data[2]) + 1, 5, '0') + _.padStart('0', 10, '0');
    } else if ((data = versionNo.match(/^\^([0-9]{1,3}).([0-9]{1,5}).([0-9]{1,10})$/))) {
        //"^1.2.3"
        flag = true;
        min = data[1] + _.padStart(data[2], 5, '0') + _.padStart(data[3], 10, '0');
        max = _.toString(parseInt(data[1]) + 1) + _.padStart(0, 5, '0') + _.padStart('0', 10, '0');
    } else if (
        (data = versionNo.match(
            /^([0-9]{1,3}).([0-9]{1,5}).([0-9]{1,10})\s?-\s?([0-9]{1,3}).([0-9]{1,5}).([0-9]{1,10})$/,
        ))
    ) {
        // "1.2.3 - 1.2.7"
        flag = true;
        min = data[1] + _.padStart(data[2], 5, '0') + _.padStart(data[3], 10, '0');
        max = data[4] + _.padStart(data[5], 5, '0') + _.padStart(parseInt(data[6]) + 1, 10, '0');
    } else if (
        (data = versionNo.match(
            /^>=([0-9]{1,3}).([0-9]{1,5}).([0-9]{1,10})\s?<([0-9]{1,3}).([0-9]{1,5}).([0-9]{1,10})$/,
        ))
    ) {
        // ">=1.2.3 <1.2.7"
        flag = true;
        min = data[1] + _.padStart(data[2], 5, '0') + _.padStart(data[3], 10, '0');
        max = data[4] + _.padStart(data[5], 5, '0') + _.padStart(data[6], 10, '0');
    }
    return [flag, min, max];
};

common.createFileFromRequest = async function (url, filePath) {
    try {
        await fs.promises.stat(filePath);
        return;
    } catch (err) {
        if (err.code !== 'ENOENT') {
            throw error;
        }
    }

    logger.debug(`createFileFromRequest url:${url}`);
    const response = await fetch(url);
    if (!response.ok) {
        throw new AppError(`unexpected response ${response.statusText}`);
    }
    await streamPipeline(response.body, fs.createWriteStream(filePath));
};

common.copySync = function (sourceDst, targertDst) {
    return fsextra.copySync(sourceDst, targertDst, { overwrite: true });
};

common.copy = function (sourceDst, targertDst) {
    return new Promise((resolve, reject) => {
        fsextra.copy(sourceDst, targertDst, { overwrite: true }, function (err) {
            if (err) {
                logger.error(err);
                reject(err);
            } else {
                logger.debug(`copy success sourceDst:${sourceDst} targertDst:${targertDst}`);
                resolve();
            }
        });
    });
};

common.move = function (sourceDst, targertDst) {
    return new Promise((resolve, reject) => {
        fsextra.move(sourceDst, targertDst, { overwrite: true }, function (err) {
            if (err) {
                logger.error(err);
                reject(err);
            } else {
                logger.debug(`move success sourceDst:${sourceDst} targertDst:${targertDst}`);
                resolve();
            }
        });
    });
};

common.deleteFolder = function (folderPath) {
    return new Promise((resolve, reject) => {
        fsextra.remove(folderPath, function (err) {
            if (err) {
                logger.error(err);
                reject(err);
            } else {
                logger.debug(`deleteFolder delete ${folderPath} success.`);
                resolve(null);
            }
        });
    });
};

common.deleteFolderSync = function (folderPath) {
    return fsextra.removeSync(folderPath);
};

common.createEmptyFolder = function (folderPath) {
    return new Promise((resolve, reject) => {
        logger.debug(`createEmptyFolder Create dir ${folderPath}`);
        return common.deleteFolder(folderPath).then((data) => {
            fsextra.mkdirs(folderPath, (err) => {
                if (err) {
                    logger.error(err);
                    reject(new AppError(err.message));
                } else {
                    resolve(folderPath);
                }
            });
        });
    });
};

common.createEmptyFolderSync = function (folderPath) {
    common.deleteFolderSync(folderPath);
    return fsextra.mkdirsSync(folderPath);
};

common.unzipFile = async function (zipFile, outputPath) {
    try {
        logger.debug(`unzipFile check zipFile ${zipFile} fs.R_OK`);
        fs.accessSync(zipFile, fs.R_OK);
        logger.debug(`Pass unzipFile file ${zipFile}`);
    } catch (err) {
        logger.error(err);
        throw new AppError(err.message);
    }

    try {
        await extract(zipFile, { dir: outputPath });
        logger.debug(`unzipFile success`);
    } catch (err) {
        logger.error(err);
        throw new AppError(`it's not a zipFile`);
    }
    return outputPath;
};

common.getBlobDownloadUrl = function (blobUrl) {
    var fileName = blobUrl;
    var storageType = _.get(config, 'common.storageType');
    var downloadUrl = _.get(config, `${storageType}.downloadUrl`);
    if (storageType === 'local') {
        fileName = blobUrl.substr(0, 2).toLowerCase() + '/' + blobUrl;
    }
    if (!validator.isURL(downloadUrl)) {
        var e = new AppError(`Please config ${storageType}.downloadUrl in config.js`);
        logger.error(e);
        throw e;
    }
    return `${downloadUrl}/${fileName}`;
};

common.diffCollectionsSync = function (collection1, collection2) {
    var diffFiles = [];
    var collection1Only = [];
    var newCollection2 = Object.assign({}, collection2);
    if (collection1 instanceof Object) {
        for (var key of Object.keys(collection1)) {
            if (_.isEmpty(newCollection2[key])) {
                collection1Only.push(key);
            } else {
                if (!_.eq(collection1[key], newCollection2[key])) {
                    diffFiles.push(key);
                }
                delete newCollection2[key];
            }
        }
    }
    return {
        diff: diffFiles,
        collection1Only: collection1Only,
        collection2Only: Object.keys(newCollection2),
    };
};
