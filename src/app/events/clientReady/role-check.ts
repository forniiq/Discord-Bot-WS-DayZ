import type { EventHandler } from 'commandkit';
import { Logger } from 'commandkit/logger';

const ROLE_ID = process.env.START_ROLE_ID as string;
const GUILD_ID = process.env.GUILD_ID as string;

const handler: EventHandler<'clientReady'> = async (client) => {
    for (const guild of client.guilds.cache.values()) {
        try {
            const guild = client.guilds.cache.get(GUILD_ID);

            if (!guild) {
                Logger.error(`[ROLE CHECK] Сервер с ID ${GUILD_ID} не найден. Проверка отменена.`);
                return;
            }

            const members = await guild.members.fetch();
            const missingRoleMembers = members.filter(member => !member.roles.cache.has(ROLE_ID) && !member.user.bot);

            if (missingRoleMembers.size > 0) {
                Logger.log(`[ROLE CHECK] Найдено пользователей без роли: ${missingRoleMembers.size}. Начинаю выдачу...`);

                let successCount = 0;

                for (const member of missingRoleMembers.values()) {
                    try {
                        await member.roles.add(ROLE_ID);
                        successCount++
                    } catch (error) {
                        Logger.error(`[ROLE CHECK] Не удалось выдать роль пользователю ${member.user.tag}: ${error}`);
                    }
                }

                Logger.info(`[ROLE CHECK] Успешно выдано пропущенных ролей: ${successCount}/${missingRoleMembers.size}`);
            } else {
                Logger.log(`[ROLE CHECK] На сервере все пользователи имеют роль. Пропущенных нет.`);
            }
        } catch (error) {
            Logger.error(`[ROLE CHECK] Ошибка сканирования сервера: ${error}`);
        }
    }
};

export default handler;