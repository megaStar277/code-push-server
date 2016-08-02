"use strict";

var _ = require('lodash');

module.exports = function(sequelize, DataTypes) {
  var Deployments = sequelize.define("Deployments", {
    id: {
      type: DataTypes.INTEGER(10),
      allowNull: false,
      autoIncrement: true,
      primaryKey: true
    },
    appid: DataTypes.INTEGER(10),
    name: DataTypes.STRING,
    description: DataTypes.STRING,
    deployment_key: DataTypes.STRING,
    last_deployment_version_id: DataTypes.INTEGER(10),
    label_id: DataTypes.INTEGER(10),
    created_at: DataTypes.TIME,
    updated_at: DataTypes.TIME,
  }, {
    tableName: 'deployments',
    underscored: true,
    paranoid: true,
    classMethods: {
      generateLabelId: function(deploymentId) {
        var _this = this;
        return sequelize.transaction(function (t) {
          return _this.findById(deploymentId, {transaction: t,lock: t.LOCK.UPDATE}).then(function (data) {
            if (_.isEmpty(data)){
              throw new Error("does not find deployment");
            }
            data.label_id = data.label_id + 1;
            return data.save({transaction: t}).then(function (data) {
              return data.label_id;
            });
          });
        });
      }
    }
  });

  return Deployments;
};
