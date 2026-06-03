import type { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit';
import { ApplicationCommandOptionType, EmbedBuilder } from 'discord.js';
import { User } from '../../models/users'; // Путь к твоей модели User
import { sendLog } from '@/app/utils/logger';
import { Logger } from 'commandkit/logger';

export const metadata: CommandMetadata = {
    guilds: [process.env.GUILD_ID as string]
};

export const command: CommandData = {
    name: 'pay',
    description: '💸 Перевести внутриигровые деньги другому выжившему',
    options: [
        {
            name: 'target-user',
            description: 'Пользователь, которому вы хотите перевести деньги',
            type: ApplicationCommandOptionType.User,
            required: true,
        },
        {
            name: 'amount',
            description: 'Сумма перевода',
            type: ApplicationCommandOptionType.Integer,
            required: true,
            min_value: 1,
        }
    ],
};

export const chatInput: ChatInputCommand = async (ctx) => {
    await ctx.interaction.deferReply().catch(() => null);

    const targetUser = ctx.interaction.options.getUser('target-user', true);
    const amount = ctx.interaction.options.getInteger('amount', true);
    const author = ctx.interaction.user;

    if (targetUser.id === author.id) {
        return void await ctx.interaction.editReply({
            content: '❌ **Ошибка:** Вы не можете перевести деньги самому себе.'
        });
    }

    if (targetUser.bot) {
        return void await ctx.interaction.editReply({
            content: '❌ **Ошибка:** Вы не можете переводить деньги ботам.'
        });
    }

    try {
        const [senderData] = await User.findOrCreate({
            where: { discordId: author.id },
        });

        const senderBalance = Number((senderData as any).money) || 0;

        if (senderBalance < amount) {
            return void await ctx.interaction.editReply({
                content: `❌ **Недостаточно средств:** Ваш текущий баланс: \`${senderBalance.toLocaleString('ru-RU')}\` ₽. Вам не хватает \ ${(amount - senderBalance).toLocaleString('ru-RU')} \ ₽.`
            });
        }

        const [receiverData] = await User.findOrCreate({
            where: { discordId: targetUser.id },
        });

        const receiverBalance = Number((receiverData as any).money) || 0;

        (senderData as any).money = senderBalance - amount;
        (receiverData as any).money = receiverBalance + amount;

        await senderData.save();
        await receiverData.save();

        await sendLog(
            'INFO', 
            'ECONOMY-PAY', 
            `Игрок ${author.tag} (${author.id}) перевёл ${amount} ₽ игроку ${targetUser.tag} (${targetUser.id}).\n` +
            `Баланс отправителя стал: ${(senderBalance - amount)} ₽ | Баланс получателя стал: ${(receiverBalance + amount)} ₽`
        );

        const successEmbed = new EmbedBuilder()
            .setTitle('💸 Перевод успешно выполнен!')
            .setColor('#2ecc71')
            .setDescription(
                `Вы успешно перевели деньги другому выжившему.\n\n` +
                `• **Отправитель:** ${author}\n` +
                `• **Получатель:** ${targetUser}\n` +
                `• **Сумма перевода:** \`${amount.toLocaleString('ru-RU')}\` ₽\n\n` +
                `*Ваш новый баланс:* \`${(senderBalance - amount).toLocaleString('ru-RU')}\` ₽`
            )
            .setTimestamp();

        return void await ctx.interaction.editReply({ embeds: [successEmbed] });

    } catch (error) {
        Logger.error(`[TRANSACTION ERROR] Ошибка при выполнении перевода /pay: ${error}`);
        return void await ctx.interaction.editReply({
            content: '❌ **Критическая ошибка:** Не удалось завершить транзакцию. Попробуйте позже или обратитесь в тех. поддержку.',
        });
    }
};