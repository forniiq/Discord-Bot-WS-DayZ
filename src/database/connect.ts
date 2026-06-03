import { Sequelize } from 'sequelize';
import { Logger } from 'commandkit/logger';

export const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite', 
    logging: false,
});

export const connectDB = async () => {
    try {
        await sequelize.authenticate();
        await sequelize.sync(); 

        Logger.info('[DATABASE] База данных успешно инициализирована.');
    } catch (error) {
        Logger.error(`[DATABASE] Критическая ошибка подключения: ${error}`);
        process.exit(1);
    }
};