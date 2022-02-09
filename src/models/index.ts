import { Sequelize } from 'sequelize';
import { config } from '../core/config';

export const sequelize = new Sequelize(
    config.db.database,
    config.db.username,
    config.db.password,
    config.db,
);
