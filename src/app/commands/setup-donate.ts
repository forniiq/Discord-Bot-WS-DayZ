import type { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit';
import { ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder, ChannelType } from 'discord.js';
import { sendLog } from '@/app/utils/logger';

export const metadata: CommandMetadata = {
    userPermissions: 'Administrator',
    guilds: [process.env.GUILD_ID as string]
};

export const command: CommandData = {
    name: 'setup-donate',
    description: '💰 Установить меню покупки доната в текущий канал',
};

export const chatInput: ChatInputCommand = async (ctx) => {
    await ctx.interaction.deferReply({ ephemeral: true });

    const channel = ctx.interaction.channel;
    if (!channel || channel.type !== ChannelType.GuildText) {
        return void await ctx.interaction.editReply({ 
            content: '❌ Эта команда может быть использована только в текстовом канале сервера.' 
        });
    }

    const embed = new EmbedBuilder()
        .setTitle('🛒 Магазин доната Union WS DayZ')
        .setDescription('Выберите интересующий вас товар или услугу из списка ниже. После выбора будет создан приватный канал для оплаты.')
        .setColor('#2b2d31')
        .setFooter({ text: 'Union WS • Автоматизированная система заявок' });

    const menu = new StringSelectMenuBuilder()
        .setCustomId('donate_select')
        .setPlaceholder('🛒 Выберите товар для покупки...')
        .addOptions([
            { label: 'VIP Статус (30 дней)', description: 'Цена: 350 руб. | Ускоренный вход, кит-наборы', value: 'vip_350' },
            { label: 'Донат-Сет "Выживший"', description: 'Цена: 500 руб. | Топовый лут в закрепе', value: 'set_survivor_500' },
            { label: 'Валюта сервера (500,000 руб.)', description: 'Цена: 200 руб. | Зачисление на игровой баланс', value: 'money_200' },
        ]);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);

    await channel.send({ embeds: [embed], components: [row] });
    await sendLog('INFO', 'SHOP-SETUP', `Администратор ${ctx.interaction.user.tag} установил меню доната в канал <#${channel.id}>`);
    
    return void await ctx.interaction.editReply({ content: '✅ Меню доната успешно установлено в этот канал!' });
};