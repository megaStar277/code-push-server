"use strict";

var _ = require('lodash');

module.exports = function(sequelize, DataTypes) {
  var PackagesMetrics = sequelize.define("PackagesMetrics", {
    id: {
      type: DataTypes.INTEGER(10),
      allowNull: false,
      autoIncrement: true,
      primaryKey: true
    },
    package_id: DataTypes.INTEGER(10),
    active: DataTypes.INTEGER(10),
    downloaded: DataTypes.INTEGER(10),
    failed: DataTypes.INTEGER(10),
    installed: DataTypes.INTEGER(10),
    created_at: DataTypes.TIME,
    updated_at: DataTypes.TIME,
  }, {
    tableName: 'packages_metrics',
    underscored: true,
    classMethods: {
      addOne : function (packageId, fieldName) {
        var _this = this;
        var sql = 'UPDATE packages_metrics SET  `' + fieldName + '`=`' + fieldName + '` + 1 WHERE package_id = :package_id';
        return sequelize.query(sql, { replacements: { package_id: packageId}}).spread(function(results, metadata) {
          if (_.eq(results.affectedRows, 0)) {
            var params = {
              package_id: packageId,
              active: 0,
              downloaded: 0,
              failed: 0,
              installed: 0,
            };
            params[fieldName] = 1;
            return _this.create(params);
          }else {
            return true;
          }
        });
      },
      addOneOnDownloadById: function (packageId) {
        return this.addOne(packageId, 'downloaded');
      },
      addOneOnFailedById: function (packageId) {
        return this.addOne(packageId, 'failed');
      },
      addOneOnInstalledById: function (packageId) {
        return this.addOne(packageId, 'installed');
      },
      addOneOnActiveById: function (packageId) {
        return this.addOne(packageId, 'active');
      },
    }
  });
  return PackagesMetrics;
};
