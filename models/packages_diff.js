"use strict";

module.exports = function(sequelize, DataTypes) {
  var PackagesDiff = sequelize.define("PackagesDiff", {
    id: {
      type: DataTypes.INTEGER(10),
      allowNull: false,
      autoIncrement: true,
      primaryKey: true
    },
    package_id: DataTypes.INTEGER(10),
    diff_against_package_hash: DataTypes.STRING,
    diff_blob_url: DataTypes.STRING,
    diff_size: DataTypes.INTEGER(10),
    created_at: DataTypes.TIME,
    updated_at: DataTypes.TIME,
  }, {
    tableName: 'packages_diff',
    underscored: true,
  });

  return PackagesDiff;
};
