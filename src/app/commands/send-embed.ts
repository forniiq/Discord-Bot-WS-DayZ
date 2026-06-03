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
            name: 'url',
            description: 'Ссылка на общую конфигурацию из конструктора (например, Discohook). Игнорирует поля текста.',
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

    const constructorUrl = ctx.interaction.options.getString('url');
    const title = ctx.interaction.options.getString('title');
    const description = ctx.interaction.options.getString('description');
    const mentionable = ctx.interaction.options.getMentionable('mention');
    const color = ctx.interaction.options.getString('color') || '#2b2d31';
    const imageUrl = ctx.interaction.options.getString('image');
    const thumbnailUrl = ctx.interaction.options.getString('thumbnail');

    const validSendableTypes = [
        ChannelType.GuildText,
        ChannelType.GuildAnnouncement,
        ChannelType.PublicThread,
        ChannelType.PrivateThread,
        ChannelType.AnnouncementThread
    ];

    const resolvedChannel = ctx.interaction.options.getChannel('channel');
    let targetChannel: any = ctx.interaction.channel;

    if (resolvedChannel) {
        try {
            const fetchedChannel = ctx.interaction.guild?.channels.cache.get(resolvedChannel.id) 
                || await ctx.interaction.guild?.channels.fetch(resolvedChannel.id);
            
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
            content: '❌ **Ошибка:** Целевой канал не найден или имеет неверный тип.'
        });
    }

    try {
        let messagePayload: any = {};

        // === РЕЖИМ 1: ПОЛУЧЕНИЕ ДАННЫХ ИЗ КОНСТРУКТОРА ПО ССЫЛКЕ ===
        if (constructorUrl) {
            try {
                let parsedUrl: URL;
                try {
                    parsedUrl = new URL(constructorUrl);
                } catch {
                    throw new Error('Указана некорректная ссылка.');
                }

                let apiUrl = '';

                // 1. Проверка для Message Style (https://message.style/share/XXXXXX)
                if (parsedUrl.hostname.includes('message.style')) {
                    const paths = parsedUrl.pathname.split('/');
                    const shareId = paths.pop() ?? paths.pop() ?? '';
                    
                    if (!shareId) throw new Error('Не удалось извлечь ID шаблона из ссылки Message Style.');
                    
                    apiUrl = `https://api.message.style/api/v1/share/${shareId}`;
                } 
                // 2. Проверка для Discohook (на всякий случай)
                else if (parsedUrl.hostname.includes('discohook.app') || parsedUrl.hostname.includes('discohook.org')) {
                    let shareId = '';
                    if (parsedUrl.hostname.includes('discohook.app')) {
                        const paths = parsedUrl.pathname.split('/');
                        shareId = paths.pop() ?? '';
                    } else {
                        shareId = parsedUrl.searchParams.get('id') ?? '';
                    }
                    
                    if (!shareId) throw new Error('Не удалось извлечь ID шаблона из ссылки Discohook.');
                    apiUrl = `https://api.discohook.org/share/${shareId}`;
                } else {
                    throw new Error('Поддерживаются только ссылки из конструкторов Message Style или Discohook.');
                }

                // Делаем запрос к API конструктора
                const response = await fetch(apiUrl);
                if (!response.ok) {
                    throw new Error('Не удалось получить данные с сервера конструктора. Возможно, ссылка устарела или была удалена.');
                }

                const sharedData = await response.json();
                
                // Унифицируем парсинг: Message Style отдаёт массив json объектов, либо объект с полем data
                const rawPayload = sharedData.data?.messages?.[0] || sharedData.messages?.[0] || sharedData.data || sharedData;
                
                messagePayload = {
                    content: rawPayload.content || null,
                    embeds: rawPayload.embeds || []
                };

                if (!messagePayload.content && (!messagePayload.embeds || messagePayload.embeds.length === 0)) {
                    throw new Error('Конфигурация по ссылке пустая (нет ни текста, ни эмбедов).');
                }
            } catch (e: any) {
                return void await ctx.interaction.editReply({
                    content: `❌ **Ошибка парсинга ссылки:** ${e.message}`
                });
            }
        }
        // === РЕЖИМ 2: СТАНДАРТНЫЙ ВСТРОЕННЫЙ КОНСТРУКТОР ===
        else {
            if (!title || !description) {
                return void await ctx.interaction.editReply({
                    content: '❌ **Ошибка:** Заполните поля `title` и `description`, либо укажите ссылку в поле `url`.'
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
                if (isValidUrl(imageUrl)) userEmbed.setImage(imageUrl);
                else return void await ctx.interaction.editReply({ content: '❌ **Ошибка:** Неверный формат URL в поле `image`.' });
            }

            if (thumbnailUrl) {
                if (isValidUrl(thumbnailUrl)) userEmbed.setThumbnail(thumbnailUrl);
                else return void await ctx.interaction.editReply({ content: '❌ **Ошибка:** Неверный формат URL в поле `thumbnail`.' });
            }

            messagePayload = { embeds: [userEmbed] };

            if (mentionable) {
                messagePayload.content = `${mentionable}`;
            }
        }

        // === ОТПРАВКА (ТЕКСТ / ВЕТКИ / ФОРУМЫ) ===
        let logTargetId = targetChannel.id;

        if (targetChannel.type === ChannelType.GuildForum) {
            // Определяем название новой темы на форуме
            const threadName = title || messagePayload.embeds?.[0]?.title || messagePayload.embeds?.[0]?.data?.title || 'Новое объявление';

            const forumPost = await targetChannel.threads.create({
                name: threadName,
                message: messagePayload,
                reason: `Команда /send-embed от ${ctx.interaction.user.tag}`
            });
            logTargetId = forumPost.id;
        } else {
            await targetChannel.send(messagePayload);
        }

        // Логирование
        const logDetails = constructorUrl ? `Отправлен эмбед по ссылке: ${constructorUrl}` : `Заголовок: ${title}`;
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
            content: `❌ **Не удалось отправить сообщение.** Проверьте права бота на отправку сообщений/ссылок или корректность структуры данных на сайте.`
        });
    }
};