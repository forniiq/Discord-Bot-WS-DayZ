import { DataTypes, Model, InferAttributes, InferCreationAttributes } from 'sequelize';
import { sequelize } from '../database/connect.js';

export class Trade extends Model<InferAttributes<Trade>, InferCreationAttributes<Trade>> {
    declare tradeId: string;
    declare messageId: string;
    declare originalPrice: string;
    declare currentPrice: number;
    declare type: 'currency' | 'barter';
    declare sellerId: string;
    declare buyerId: string | null;
    declare sellerConfirmed: boolean;
    declare buyerConfirmed: boolean;
    declare status: 'active' | 'processing' | 'closed';
    declare server: string;
    declare item: string;
}

Trade.init(
    {
        tradeId: { type: DataTypes.STRING, primaryKey: true, allowNull: false },
        messageId: { type: DataTypes.STRING, allowNull: false },
        originalPrice: { type: DataTypes.STRING(1000), allowNull: false },
        currentPrice: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        type: { type: DataTypes.ENUM('currency', 'barter'), allowNull: false },
        sellerId: { type: DataTypes.STRING, allowNull: false },
        buyerId: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
        sellerConfirmed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        buyerConfirmed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        status: { type: DataTypes.ENUM('active', 'processing', 'closed'), allowNull: false, defaultValue: 'active' },
        server: { type: DataTypes.STRING, allowNull: false },
        item: { type: DataTypes.STRING(1000), allowNull: false },
    },
    {
        sequelize,
        tableName: 'active_trades',
        timestamps: true
    }
);