import type { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit';
import { EmbedBuilder } from 'discord.js';
import { User } from '../../models/users';
import { Logger } from 'commandkit/logger';

export const metadata: CommandMetadata = {
    guilds: [process.env.GUILD_ID as string]
};

export const command: CommandData = {
    name: 'leaderboard',
    description: '🏆 Топ-10 богатых выживших сервера по балансу',
};

export const chatInput: ChatInputCommand = async (ctx) => {
    await ctx.interaction.deferReply().catch(() => null);

    try {

        const topUsers = await User.findAll({
            order: [['money', 'DESC']],
            limit: 10,
        });

        if (!topUsers || topUsers.length === 0) {
            return void await ctx.interaction.editReply({
                content: '❌ **Ошибка:** В базе данных пока нет зарегистрированных игроков.'
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('🏆 ТАБЛИЦА ЛИДЕРОВ — БОГАТЕЙШИЕ ИГРОКИ')
            .setColor('#f1c40f')
            .setTimestamp()
            .setFooter({ text: 'Обновляется в реальном времени' });

        let descriptionLines: string[] = [];

        // Перебираем игроков и формируем строки
        for (let i = 0; i < topUsers.length; i++) {
            const userData = topUsers[i] as any;
            const discordId = userData.discordId;
            const money = Number(userData.money) || 0;

            let placeEmoji = `\`[#${i + 1}]\``;
            if (i === 0) placeEmoji = '🥇';
            if (i === 1) placeEmoji = '🥈';
            if (i === 2) placeEmoji = '🥉';

            const formattedMoney = money.toLocaleString('ru-RU');

            descriptionLines.push(`${placeEmoji} <@${discordId}> — **${formattedMoney}** ₽`);
        }

        embed.setDescription(descriptionLines.join('\n'));

        return void await ctx.interaction.editReply({ embeds: [embed] });

    } catch (error) {
        Logger.error(`[DATABASE ERROR] Ошибка при создании таблицы лидеров: ${error}`);
        return void await ctx.interaction.editReply({
            content: '❌ **Критическая ошибка:** Не удалось загрузить таблицу лидеров.',
        });
    }
};