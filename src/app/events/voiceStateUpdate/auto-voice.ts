import type { EventHandler } from 'commandkit';
import { ChannelType } from 'discord.js';
import { Logger } from 'commandkit/logger';

const CATEGORY_ID = process.env.AUTO_VOICE_CATEGORY_ID as string;
const TRIGGER_CHANNEL_ID = process.env.AUTO_VOICE_TRIGGER_CHANNEL_ID as string;

const activeVoiceChannels = new Set<string>();

const handler: EventHandler<'voiceStateUpdate'> = async (oldState, newState) => {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    if (newState.channelId === TRIGGER_CHANNEL_ID) {
        try {
            // Создаем новый голосовой канал в нужной категории
            const customChannel = await newState.guild.channels.create({
                name: `🔊 [Пати] ${member.user.username}`,
                type: ChannelType.GuildVoice,
                parent: CATEGORY_ID,
                userLimit: 6,
            });

            activeVoiceChannels.add(customChannel.id);

            await newState.setChannel(customChannel).catch(() => null);

        } catch (error: any) {
            Logger.error(`[AUTO-VOICE] Ошибка при создании авто-комнаты: ${error.message}`);
        }
    }

    if (oldState.channelId && oldState.channelId !== newState.channelId) {
        if (activeVoiceChannels.has(oldState.channelId)) {
            const oldChannel = oldState.channel;
            const currentChannel = oldState.guild.channels.cache.get(oldState.channelId);
            
            if (currentChannel && currentChannel.isVoiceBased() && currentChannel.members.size === 0) {
                try {
                    await currentChannel.delete();
                    activeVoiceChannels.delete(oldState.channelId);
                } catch (error: any) {
                    activeVoiceChannels.delete(oldState.channelId);
                }
            }
        }
    }
};

export default handler;