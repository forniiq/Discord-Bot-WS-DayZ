import type { EventHandler } from 'commandkit';
import { EmbedBuilder, ChannelType, ActivityType } from 'discord.js';
import { GameDig } from 'gamedig';
import { Logger } from 'commandkit/logger';

// ==========================================
//                 КОНФИГУРАЦИЯ
// ==========================================
const SERVERS_CONFIG = [
    /*{
        channelId: '1461461226247815291', // Канал для 1-го сервера
        connectPort: 2802,                 // Порт для подключения игроков в Embed
        query: {
            type: 'dayz' as const,
            host: '80.242.59.106',
            port: 2803,                    // Порт запроса GameDig
            name: 'Namalsk'
        }
    },*/
    {
        channelId: '1503498716756054286',
        connectPort: 2702,
        query: {
            type: 'dayz' as const,
            host: '80.242.59.106',
            port: 2703,
            name: 'Chernarus'
        }
    }
];

const CONFIG = {
    updateInterval: 60 * 1000,    // Частота обновления каналов (1 минута)
    activityInterval: 15 * 1000,  // Частота обновления активности бота (15 секунд)
    maxFailedAttempts: 3
};

const serverStatsMemory: Map<string, { current: number; max: number; name: string; isOnline: boolean }> = new Map();
const failedAttemptsMap: Map<string, number> = new Map();

const handler: EventHandler<'clientReady'> = async (client) => {
    Logger.info(`[STATUS] Мониторинг успешно запущен для ${SERVERS_CONFIG.length} серверов.`);

    const updateSingleServer = async (serverData: typeof SERVERS_CONFIG[0]) => {
        const channel = client.channels.cache.get(serverData.channelId);
        if (!channel || channel.type !== ChannelType.GuildText) {
            Logger.error(`[STATUS] Текстовый канал с ID ${serverData.channelId} не найден.`);
            return;
        }

        const serverKey = `${serverData.query.host}:${serverData.query.port}`;
        let failedAttempts = failedAttemptsMap.get(serverKey) || 0;

        try {
            const state = await GameDig.query(serverData.query);
            failedAttempts = 0;
            failedAttemptsMap.set(serverKey, failedAttempts);

            serverStatsMemory.set(serverKey, {
                current: state.players.length,
                max: state.maxplayers,
                name: serverData.query.name,
                isOnline: true
            });

            const statusEmbed = new EmbedBuilder()
                .setTitle(`🖥️ Мониторинг игровых серверов`)
                .setColor('#2b2d31')
                .addFields(
                    { name: '📌 Сервер', value: `\`\`\`📊 [RU] ${state.name || serverData.query.name}\`\`\``, inline: false },
                    { name: '🌐 Адрес подключения', value: `\`${serverData.query.host}:${serverData.connectPort}\``, inline: true },
                    { name: '👥 Текущий онлайн', value: `👤 **${state.players.length}** / **${state.maxplayers}**`, inline: true },
                    { name: '🗺️ Карта', value: `\`${state.map || 'DayZ'}\``, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Синхронизировано со Steam API' });

            const fetchedMessages = await channel.messages.fetch({ limit: 5 }).catch(() => null);
            const botMessage = fetchedMessages?.find(msg => msg.author.id === client.user?.id);

            if (botMessage) {
                await botMessage.edit({ content: null, embeds: [statusEmbed] }).catch(() => null);
            } else {
                await channel.send({ embeds: [statusEmbed] }).catch(() => null);
            }

        } catch (error) {
            if (error instanceof Error && (error.message?.includes('fetch') || (error as any).code === 'UND_ERR_CONNECT_TIMEOUT')) {
                return; 
            }

            failedAttempts++;
            failedAttemptsMap.set(serverKey, failedAttempts);
            Logger.warn(`[STATUS ERROR] Сервер ${serverData.query.name} не ответил (${failedAttempts}/${CONFIG.maxFailedAttempts})`);

            if (failedAttempts >= CONFIG.maxFailedAttempts) {
                serverStatsMemory.set(serverKey, {
                    current: 0,
                    max: 0,
                    name: serverData.query.name,
                    isOnline: false
                });

                const offlineEmbed = new EmbedBuilder()
                    .setTitle('❌ Мониторинг игровых серверов')
                    .setDescription(`>>> ⚠️ **Внимание:** Сервер **${serverData.query.name}** временно недоступен. Возможные причины: плановый рестарт, обновление модов или тех. работы.`)
                    .setColor('#ff4747')
                    .addFields(
                        { name: '🌐 Адрес сервера', value: `\`${serverData.query.host}:${serverData.connectPort}\``, inline: true },
                        { name: '📊 Статус', value: '🔴 **OFFLINE / RESTART**', inline: true }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'Синхронизировано со Steam API' });

                const fetchedMessages = await channel.messages.fetch({ limit: 5 }).catch(() => null);
                const botMessage = fetchedMessages?.find(msg => msg.author.id === client.user?.id);

                if (botMessage) {
                    await botMessage.edit({ content: null, embeds: [offlineEmbed] }).catch(() => null);
                } else {
                    await channel.send({ embeds: [offlineEmbed] }).catch(() => null);
                }
            }
        }
    };

    const updateAllServers = async () => {
        for (const serverData of SERVERS_CONFIG) {
            await updateSingleServer(serverData);
        }

        updateTotalActivity();
    };

    const updateTotalActivity = () => {
        const statsList = Array.from(serverStatsMemory.values());
        if (statsList.length === 0) {
            client.user?.setActivity({
                name: 'Получение данных СОЮЗ WS...',
                type: ActivityType.Watching
            });
            return;
        }

        let totalCurrent = 0;
        let totalMax = 0;
        let onlineServersCount = 0;

        for (const server of statsList) {
            totalCurrent += server.current;
            totalMax += server.max;
            if (server.isOnline) onlineServersCount++;
        }

        if (onlineServersCount === 0) {
            client.user?.setActivity({
                name: 'СОЮЗ WS | Тех. работы 🛠️',
                type: ActivityType.Watching
            });
        } else {
            client.user?.setActivity({
                name: `СОЮЗ WS: ${totalCurrent}/${totalMax} игроков`,
                type: ActivityType.Playing
            });
        }
    };

    await updateAllServers();

    setInterval(updateAllServers, CONFIG.updateInterval);
    setInterval(updateTotalActivity, CONFIG.activityInterval);
};

export default handler;