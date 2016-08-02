"use strict";

module.exports = function(sequelize, DataTypes) {
  var DeploymentsVersions = sequelize.define("DeploymentsVersions", {
    id: {
      type: DataTypes.INTEGER(10),
      allowNull: false,
      autoIncrement: true,
      primaryKey: true
    },
    deployment_id: DataTypes.INTEGER(10),
    app_version: DataTypes.STRING,
    is_mandatory: DataTypes.INTEGER(3),
    current_package_id: DataTypes.INTEGER(10),
    created_at: DataTypes.TIME,
    updated_at: DataTypes.TIME,
  }, {
    tableName: 'deployments_versions',
    underscored: true,
  });

  return DeploymentsVersions;
};
