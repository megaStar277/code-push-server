'use strict';
import _ from 'lodash';
import fs from 'fs';
import path from 'path';
import { logger } from 'kv-logger';
import { config } from '../config';

var security = require('../utils/security');
var common = require('../utils/common');
var AppError = require('../app-error');

const MANIFEST_FILE_NAME = 'manifest.json';
const CONTENTS_NAME = 'contents';

var proto = (module.exports = function () {
    function DataCenterManager() {}
    DataCenterManager.__proto__ = proto;
    return DataCenterManager;
});

proto.getDataDir = function () {
    var dataDir = _.get(config, 'common.dataDir', {});
    return dataDir;
};

proto.hasPackageStoreSync = function (packageHash) {
    var dataDir = this.getDataDir();
    var packageHashPath = path.join(dataDir, packageHash);
    var manifestFile = path.join(packageHashPath, MANIFEST_FILE_NAME);
    var contentPath = path.join(packageHashPath, CONTENTS_NAME);
    return fs.existsSync(manifestFile) && fs.existsSync(contentPath);
};

proto.getPackageInfo = function (packageHash) {
    if (this.hasPackageStoreSync(packageHash)) {
        var dataDir = this.getDataDir();
        var packageHashPath = path.join(dataDir, packageHash);
        var manifestFile = path.join(packageHashPath, MANIFEST_FILE_NAME);
        var contentPath = path.join(packageHashPath, CONTENTS_NAME);
        return this.buildPackageInfo(packageHash, packageHashPath, contentPath, manifestFile);
    } else {
        throw new AppError.AppError("can't get PackageInfo");
    }
};

proto.buildPackageInfo = function (packageHash, packageHashPath, contentPath, manifestFile) {
    return {
        packageHash: packageHash,
        path: packageHashPath,
        contentPath: contentPath,
        manifestFilePath: manifestFile,
    };
};

proto.validateStore = function (providePackageHash) {
    var dataDir = this.getDataDir();
    var packageHashPath = path.join(dataDir, providePackageHash);
    var manifestFile = path.join(packageHashPath, MANIFEST_FILE_NAME);
    var contentPath = path.join(packageHashPath, CONTENTS_NAME);
    if (!this.hasPackageStoreSync(providePackageHash)) {
        logger.debug(`validateStore providePackageHash not exist`);
        return Promise.resolve(false);
    }
    return security.calcAllFileSha256(contentPath).then((manifestJson) => {
        var packageHash = security.packageHashSync(manifestJson);
        logger.debug(`validateStore packageHash:`, packageHash);
        try {
            var manifestJsonLocal = JSON.parse(fs.readFileSync(manifestFile));
        } catch (e) {
            logger.debug(`validateStore manifestFile contents invilad`);
            return false;
        }
        var packageHashLocal = security.packageHashSync(manifestJsonLocal);
        logger.debug(`validateStore packageHashLocal:`, packageHashLocal);
        if (_.eq(providePackageHash, packageHash) && _.eq(providePackageHash, packageHashLocal)) {
            logger.debug(`validateStore store files is ok`);
            return true;
        }
        logger.debug(`validateStore store files broken`);
        return false;
    });
};

proto.storePackage = function (sourceDst, force) {
    logger.debug(`storePackage sourceDst:`, sourceDst);
    if (_.isEmpty(force)) {
        force = false;
    }
    var self = this;
    return security.calcAllFileSha256(sourceDst).then((manifestJson) => {
        var packageHash = security.packageHashSync(manifestJson);
        logger.debug('storePackage manifestJson packageHash:', packageHash);
        var dataDir = self.getDataDir();
        var packageHashPath = path.join(dataDir, packageHash);
        var manifestFile = path.join(packageHashPath, MANIFEST_FILE_NAME);
        var contentPath = path.join(packageHashPath, CONTENTS_NAME);
        return self.validateStore(packageHash).then((isValidate) => {
            if (!force && isValidate) {
                return self.buildPackageInfo(
                    packageHash,
                    packageHashPath,
                    contentPath,
                    manifestFile,
                );
            } else {
                logger.debug(`storePackage cover from sourceDst:`, sourceDst);
                return common.createEmptyFolder(packageHashPath).then(() => {
                    return common.copy(sourceDst, contentPath).then(() => {
                        var manifestString = JSON.stringify(manifestJson);
                        fs.writeFileSync(manifestFile, manifestString);
                        return self.buildPackageInfo(
                            packageHash,
                            packageHashPath,
                            contentPath,
                            manifestFile,
                        );
                    });
                });
            }
        });
    });
};
