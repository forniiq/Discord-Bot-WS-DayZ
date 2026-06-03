import { DataTypes, Model, InferAttributes, InferCreationAttributes } from 'sequelize';
import { sequelize } from '../database/connect.js'; // Не забываем про .js для ESM

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
    declare discordId: string;
    declare steamId: string | null;
    declare money: number;
    declare kills: number;
    declare exp: number;

    [key: string]: any; 
}

User.init(
    {
        discordId: { type: DataTypes.STRING, primaryKey: true, allowNull: false },
        steamId: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
        money: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        kills: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        exp: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    { 
        sequelize, 
        tableName: 'users' 
    }
);