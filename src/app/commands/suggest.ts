import type { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit';
import { 
    ApplicationCommandOptionType, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} from 'discord.js';

export const metadata: CommandMetadata = {
    guilds: [process.env.GUILD_ID as string],
};

export const command: CommandData = {
    name: 'suggest',
    description: '💡 Предложить идею для развития DayZ сервера',
    options: [
        {
            name: 'title',
            description: 'Краткое название вашей идеи (например: Вертолеты Ми-8)',
            type: ApplicationCommandOptionType.String,
            required: true,
        },
        {
            name: 'description',
            description: 'Подробно опишите вашу идею, почему это нужно серверу?',
            type: ApplicationCommandOptionType.String,
            required: true,
        }
    ]
};

// Изменено: теперь используется экспортируемая переменная chatInput и контекст ctx
export const chatInput: ChatInputCommand = async (ctx) => {
    await ctx.interaction.deferReply({ ephemeral: true });

    const title = ctx.interaction.options.getString('title', true);
    const description = ctx.interaction.options.getString('description', true);
    
    const channelId = process.env.SUGGESTION_CHANNEL_ID; 
    const targetChannel = ctx.interaction.guild?.channels.cache.get(channelId as string);

    if (!targetChannel || !targetChannel.isTextBased()) {
        return void await ctx.interaction.editReply({ 
            content: '❌ Ошибка конфигурации бота: Канал для предложений не найден или настроен неверно.' 
        });
    }

    if (description.length < 10) {
        return void await ctx.interaction.editReply({
            content: '⚠️ Ваше описание слишком короткое. Опишите идею подробнее (минимум 10 символов).'
        });
    }

    const embed = new EmbedBuilder()
        .setColor('#f1c40f')
        .setTitle(`💡 Новое предложение: ${title}`)
        .setDescription(description)
        .addFields(
            { name: '👤 Автор', value: `${ctx.interaction.user} (${ctx.interaction.user.tag})`, inline: true },
            { name: '📊 Статус', value: '⏳ Открыто голосование', inline: true }
        )
        .setThumbnail(ctx.interaction.user.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: 'Проект Union WS DayZ' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`suggest_manage_${ctx.interaction.user.id}`)
            .setLabel('⚙️ Вынести вердикт (Админ)')
            .setStyle(ButtonStyle.Secondary)
    );

    try {
        const mainMessage = await targetChannel.send({
            content: '@everyone 📢 Поступило новое предложение от игрока! Проголосуйте в опросе ниже.',
            embeds: [embed],
            components: [row]
        });

        const pollMessage = await targetChannel.send({
            poll: {
                question: { text: `Голосование: ${title.substring(0, 70)}` },
                answers: [
                    { text: 'За', emoji: '👍' },
                    { text: 'Против', emoji: '👎' }
                ],
                duration: 168,
                allowMultiselect: false
            }
        });

        const rowWithPollId = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`suggest_manage_${ctx.interaction.user.id}_${pollMessage.id}`)
                .setLabel('⚙️ Вынести вердикт (Админ)')
                .setStyle(ButtonStyle.Secondary)
        );

        await mainMessage.edit({ components: [rowWithPollId] });

        return void await ctx.interaction.editReply({ 
            content: `✅ Ваше предложение успешно опубликовано в канал ${targetChannel}!` 
        });
    } catch (error) {
        console.error('Ошибка при создании предложения:', error);
        return void await ctx.interaction.editReply({ 
            content: '❌ Произошла ошибка при публикации. Проверьте права бота на отправку опросов.' 
        });
    }
};