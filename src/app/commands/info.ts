import type { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit';
import { EmbedBuilder, version as djsVersion } from 'discord.js';
import { Logger } from 'commandkit/logger';
import os from 'os';

import pack from '../../../package.json'; 

export const metadata: CommandMetadata = {
    guilds: [process.env.GUILD_ID as string]
};

export const command: CommandData = {
    name: 'info',
    description: '📊 Информация о Дискорд-сервере и модуле бота',
};

export const chatInput: ChatInputCommand = async (ctx) => {
    await ctx.interaction.deferReply().catch(() => null);

    const { guild, client } = ctx.interaction;

    if (!guild) {
        return void await ctx.interaction.editReply({
            content: '❌ Эту команду можно использовать только на сервере.'
        });
    }

    try {
        const totalSeconds = Math.floor(client.uptime! / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const uptimeString = `${days}д. ${hours}ч. ${minutes}м.`;

        const totalMembers = guild.memberCount;
        
        const apiPing = client.ws.ping;

        const infoEmbed = new EmbedBuilder()
            .setTitle(`📊 Информация о проекте ${guild.name}`)
            .setColor('#2b2d31')
            .setThumbnail(guild.iconURL({ size: 256 }))
            .setDescription('Технический статус систем и общая статистика Дискорд-сервера.')
            .addFields(
                {
                    name: '🏰 О Discord Сервере',
                    value: [
                        `• **Участников:** \`${totalMembers}\``,
                        `• **Создан:** <t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
                        `• **ID Сервера:** \`${guild.id}\``,
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '🤖 О Модуле Бота',
                    value: [
                        `• **Версия бота:** \`v${pack.version}\``,
                        `• **Пинг API:** \`${apiPing}ms\``,
                        `• **Аптайм:** \`${uptimeString}\``,
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '⚙️ Окружение (Хостинг)',
                    value: [
                        `• **Платформа:** \`Windows Server (${os.arch()})\``,
                        `• **Ядро:** \`Discord.js v${djsVersion}\``,
                        `• **Среда:** \`Node.js ${process.version}\``
                    ].join('\n'),
                    inline: false
                }
            )
            .setTimestamp()
            .setFooter({ text: guild.name, iconURL: guild.iconURL() || undefined });

        return void await ctx.interaction.editReply({ embeds: [infoEmbed] });

    } catch (error) {
        Logger.error(`[INFO COMMAND ERROR] Ошибка при выполнении команды /info: ${error}`);
        return void await ctx.interaction.editReply({
            content: '❌ **Ошибка:** Не удалось собрать информацию о сервере.',
        });
    }
};