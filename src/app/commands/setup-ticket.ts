import type { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType } from 'discord.js';

export const metadata: CommandMetadata = {
    userPermissions: 'Administrator',
    guilds: [process.env.GUILD_ID as string]
};

export const command: CommandData = {
    name: 'setup-ticket',
    description: '🎫 Установить панель создания тикетов техподдержки',
};

export const chatInput: ChatInputCommand = async (ctx) => {
    await ctx.interaction.deferReply({ ephemeral: true });

    const channel = ctx.interaction.channel;

    if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) {
        return void await ctx.interaction.editReply({
            content: '❌ **Ошибка:** Эту команду можно использовать только в обычных текстовых каналах.'
        });
    }

    const embed = new EmbedBuilder()
        .setTitle('🎫 Техническая поддержка проекта СОЮЗ WS')
        .setDescription(
            `Добро пожаловать в центр поддержки! Если вы столкнулись с проблемой, хотите подать жалобу или задать вопрос администрации, создайте приватный тикет.\n\n` +
            `**Правила подачи обращений:**\n` +
            `• Четко и ясно излагайте суть проблемы.\n` +
            `• Подготовьте доказательства (скриншоты/видео), если вы заявляете о баге или нарушителе.\n` +
            `• Запрещен флуд, спам и оскорбления в тикетах.\n\n` +
            `*Нажмите на кнопку ниже, чтобы открыть приватный канал с администрацией.*`
        )
        .setColor('#2b2d31')
        .setFooter({ text: 'СОЮЗ WS DayZ | Поддержка' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('ticket_open')
            .setLabel('📩 Открыть тикет')
            .setStyle(ButtonStyle.Primary)
    );

    await channel.send({ embeds: [embed], components: [row] });

    return void await ctx.interaction.editReply({
        content: '✅ Панель тикетов успешно установлена в этом канале!'
    });
};