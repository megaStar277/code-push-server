"use strict";

module.exports = function(sequelize, DataTypes) {
  var UserTokens = sequelize.define("UserTokens", {
    id:{
      type: DataTypes.BIGINT(20),
      allowNull: false,
      autoIncrement: true,
      primaryKey: true
    },
    uid: DataTypes.BIGINT(20),
    tokens: DataTypes.STRING,
    description: DataTypes.STRING,
    created_by:DataTypes.STRING,
    created_at:DataTypes.TIME,
    expires_at : DataTypes.TIME
  }, {
    updatedAt: false,
    tableName: 'user_tokens',
    underscored: true,
    paranoid: true
  });

  return UserTokens;
};
