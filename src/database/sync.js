import { createRequire } from 'module';
import fs from 'fs';
import { Logger } from 'commandkit/logger';
const require = createRequire(import.meta.url);
const path = require('path');

const distPath = path.resolve(process.cwd(), 'dist');
const modelsPath = path.join(distPath, 'models');

Logger.log('[SYNC] Запуск автоматической синхронизации таблиц...');

async function run() {
    try {
        const { sequelize } = await import(`file://${path.join(distPath, 'database', 'connect.js')}`);
        
        if (fs.existsSync(modelsPath)) {
            const modelFiles = fs.readdirSync(modelsPath);
            let importedCount = 0;

            for (const file of modelFiles) {
                if (file.endsWith('.js')) {
                    const fullPath = path.join(modelsPath, file);
                    await import(`file://${fullPath}`);
                    importedCount++;
                }
            }
            Logger.info(`[SYNC] Автоматически обнаружено и импортировано моделей: ${importedCount}`);
        } else {
            Logger.warn('[SYNC] Папка с моделями не обнаружена. Проверьте структуру проекта.');
        }

        await sequelize.authenticate();
        await sequelize.sync({ alter: true });
        
        Logger.info('[SYNC] Структура базы данных успешно обновлена!');
        process.exit(0);
    } catch (error) {
        Logger.error('[SYNC] Критическая ошибка в процессе синхронизации:', error);
        process.exit(1);
    }
}

run();