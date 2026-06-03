import type { EventHandler } from 'commandkit';
import { sendLog } from '@/app/utils/logger';
import { Logger } from 'commandkit/logger';

const ROLE_ID = process.env.START_ROLE_ID as string;

const handler: EventHandler<'guildMemberAdd'> = async (member) => {
    if (member.user.bot) return;

    try {
        await member.roles.add(ROLE_ID);
        
        await sendLog('INFO', 'WELCOME', `👤 Игроку ${member.user.tag} (${member.user.id}) автоматически выдана стартовая роль.`);
        Logger.log(`[WELCOME] Новичку ${member.user.tag} успешно выдана стартовая роль.`);
    } catch (error) {
        Logger.error(`[WELCOME] Не удалось выдать роль для ${member.user.tag}: ${error}`);
    }
};

export default handler;