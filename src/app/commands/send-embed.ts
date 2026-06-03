import type { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit';
import { ApplicationCommandOptionType, ChannelType, EmbedBuilder } from 'discord.js';
import { sendLog } from '@/app/utils/logger';

export const metadata: CommandMetadata = {
    userPermissions: 'Administrator',
    guilds: [process.env.GUILD_ID as string]
};

export const command: CommandData = {
    name: 'send-embed',
    description: '📢 Создать и отправить Embed-объявление от лица бота',
    options: [
        {
            name: 'json',
            description: 'Вставьте JSON из конструктора (message.style). Игнорирует остальные поля.',
            type: ApplicationCommandOptionType.String,
            required: false,
        },
        {
            name: 'title',
            description: 'Заголовок объявления / Название темы на форуме',
            type: ApplicationCommandOptionType.String,
            required: false,
        },
        {
            name: 'description',
            description: 'Основной текст (используйте \\n для переноса строки)',
            type: ApplicationCommandOptionType.String,
            required: false,
        },
        {
            name: 'mention',
            description: 'Кого тегнуть над объявлением (например, роль или @everyone)',
            type: ApplicationCommandOptionType.Mentionable,
            required: false,
        },
        {
            name: 'channel',
            description: 'Канал для отправки (по умолчанию — текущий)',
            type: ApplicationCommandOptionType.Channel,
            // Добавляем поддержку веток и форумов в список доступных типов
            channel_types: [
                ChannelType.GuildText, 
                ChannelType.GuildAnnouncement,
                ChannelType.GuildForum,
                ChannelType.PublicThread,
                ChannelType.PrivateThread,
                ChannelType.AnnouncementThread
            ],
            required: false,
        },
        {
            name: 'color',
            description: 'Цвет боковой полосы карточки',
            type: ApplicationCommandOptionType.String,
            required: false,
            choices: [
                { name: 'Серый (Стильный)', value: '#2b2d31' },
                { name: 'Синий (Инфо)', value: '#3498db' },
                { name: 'Зеленый (Успех)', value: '#2ecc71' },
                { name: 'Красный (Внимание)', value: '#e74c3c' },
                { name: 'Золотой (Важное)', value: '#f1c40f' }
            ]
        },
        {
            name: 'image',
            description: 'Большая картинка внизу (URL-ссылка)',
            type: ApplicationCommandOptionType.String,
            required: false,
        },
        {
            name: 'thumbnail',
            description: 'Маленькая иконка в правом верхнем углу (URL-ссылка)',
            type: ApplicationCommandOptionType.String,
            required: false,
        }
    ]
};

export const chatInput: ChatInputCommand = async (ctx) => {
    await ctx.interaction.deferReply({ ephemeral: true }).catch(() => null);

    const jsonInput = ctx.interaction.options.getString('json');
    const title = ctx.interaction.options.getString('title');
    const description = ctx.interaction.options.getString('description');
    const mentionable = ctx.interaction.options.getMentionable('mention');
    const color = ctx.interaction.options.getString('color') || '#2b2d31';
    const imageUrl = ctx.interaction.options.getString('image');
    const thumbnailUrl = ctx.interaction.options.getString('thumbnail');

    // Разрешенные типы каналов для отправки напрямую
    const validSendableTypes = [
        ChannelType.GuildText,
        ChannelType.GuildAnnouncement,
        ChannelType.PublicThread,
        ChannelType.PrivateThread,
        ChannelType.AnnouncementThread
    ];

    // Безопасное получение целевого канала
    const resolvedChannel = ctx.interaction.options.getChannel('channel');
    let targetChannel: any = ctx.interaction.channel;

    if (resolvedChannel) {
        try {
            const fetchedChannel = ctx.interaction.guild?.channels.cache.get(resolvedChannel.id) 
                || await ctx.interaction.guild?.channels.fetch(resolvedChannel.id);
            
            // Расширяем проверку, включая форумы и ветки
            if (fetchedChannel && [...validSendableTypes, ChannelType.GuildForum].includes(fetchedChannel.type)) {
                targetChannel = fetchedChannel;
            } else {
                targetChannel = null;
            }
        } catch {
            targetChannel = null;
        }
    }

    if (!targetChannel) {
        return void await ctx.interaction.editReply({
            content: '❌ **Ошибка:** Целевой канал не найден, не кэширован или имеет неподдерживаемый тип.'
        });
    }

    try {
        let messagePayload: any = {};

        // === РЕЖИМ 1: ОТПРАВКА ЧЕРЕЗ JSON ===
        if (jsonInput) {
            try {
                const parsedJson = JSON.parse(jsonInput);
                messagePayload = parsedJson.messages?.[0] || parsedJson;

                if (!messagePayload.content && (!messagePayload.embeds || messagePayload.embeds.length === 0)) {
                    throw new Error('JSON должен содержать текст (content) или массив эмбедов (embeds).');
                }
            } catch (e: any) {
                return void await ctx.interaction.editReply({
                    content: `❌ **Ошибка валидации JSON:** Неверный формат строки.\n\`\`\`${e.message}\`\`\``
                });
            }
        } 
        // === РЕЖИМ 2: СТАНДАРТНЫЙ КОНСТРУКТОР ===
        else {
            if (!title || !description) {
                return void await ctx.interaction.editReply({
                    content: '❌ **Ошибка:** Заполните поля `title` и `description`, либо используйте поле `json`.'
                });
            }

            const formattedDescription = description.replace(/\\n/g, '\n');
            const userEmbed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(formattedDescription)
                .setColor(color as any)
                .setTimestamp()
                .setFooter({ 
                    text: `Опубликовал: ${ctx.interaction.user.username}`, 
                    iconURL: ctx.interaction.user.displayAvatarURL() 
                });

            const isValidUrl = (url: string) => {
                try { return Boolean(new URL(url)); } catch { return false; }
            };

            if (imageUrl) {
                if (isValidUrl(imageUrl)) {
                    userEmbed.setImage(imageUrl);
                } else {
                    return void await ctx.interaction.editReply({ content: '❌ **Ошибка:** Неверный формат URL в поле `image`.' });
                }
            }

            if (thumbnailUrl) {
                if (isValidUrl(thumbnailUrl)) {
                    userEmbed.setThumbnail(thumbnailUrl);
                } else {
                    return void await ctx.interaction.editReply({ content: '❌ **Ошибка:** Неверный формат URL в поле `thumbnail`.' });
                }
            }

            messagePayload = { embeds: [userEmbed] };

            if (mentionable) {
                messagePayload.content = `${mentionable}`;
            }
        }

        // === ЛОГИКА ОТПРАВКИ В ЗАВИСИМОСТИ ОТ ТИПА КАНАЛА ===
        let logTargetId = targetChannel.id;

        if (targetChannel.type === ChannelType.GuildForum) {
            // Форуму обязательно нужно имя темы.
            // Берем его из параметра `title`, либо из заголовка первого эмбеда в JSON, либо ставим дефолтное
            const threadName = title || messagePayload.embeds?.[0]?.title || messagePayload.embeds?.[0]?.data?.title || 'Новое объявление';

            // Создаем публикацию (пост) на форуме
            const forumPost = await targetChannel.threads.create({
                name: threadName,
                message: messagePayload,
                reason: `Команда /send-embed от ${ctx.interaction.user.tag}`
            });
            logTargetId = forumPost.id;
        } else {
            // Обычные текстовые каналы, каналы объявлений и ветки принимают сообщения напрямую
            await targetChannel.send(messagePayload);
        }

        // Логирование
        const logDetails = jsonInput ? 'Отправлен сложный Embed через JSON' : `Заголовок: ${title}`;
        await sendLog(
            'INFO', 
            'ADMIN-EMBED', 
            `Администратор ${ctx.interaction.user.tag} отправил объявление в <#${logTargetId}>\nℹ️ ${logDetails}`
        );

        return void await ctx.interaction.editReply({
            content: `✅ Объявление успешно отправлено/создано в <#${logTargetId}>!`
        });

    } catch (error: any) {
        await sendLog('ERROR', 'ADMIN-EMBED', `Ошибка отправки эмбеда админом ${ctx.interaction.user.tag}: ${error.message}`);
        return void await ctx.interaction.editReply({
            content: `❌ **Не удалось отправить сообщение.** Убедитесь, что у бота есть права на отправку сообщений/встраивание ссылок, а если это форум — право «Создавать публичные ветки» (Create Public Threads).`
        });
    }
};