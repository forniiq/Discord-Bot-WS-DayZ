import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database/connect.js';

export interface DonationAttributes {
    id: string;        // ID Discord канала-тикета
    userId: string;    // ID покупателя
    itemName: string;  // Название товара
    price: number;     // Цена
    status: 'pending' | 'paid' | 'cancelled';
}

export class Donation extends Model<DonationAttributes> implements DonationAttributes {
    declare id: string;
    declare userId: string;
    declare itemName: string;
    declare price: number;
    declare status: 'pending' | 'paid' | 'cancelled';
}

Donation.init({
    id: { type: DataTypes.STRING, primaryKey: true },
    userId: { type: DataTypes.STRING, allowNull: false },
    itemName: { type: DataTypes.STRING, allowNull: false },
    price: { type: DataTypes.INTEGER, allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: 'pending' }
}, {
    sequelize,
    tableName: 'dayz_donations'
});