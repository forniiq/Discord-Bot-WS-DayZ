import type { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit';
import { ApplicationCommandOptionType, ChannelType, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
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
            description: 'Вставьте JSON из конструктора (message.style). Игнорирует остальные поля, если заполнен.',
            type: ApplicationCommandOptionType.String,
            required: false,
        },
        {
            name: 'title',
            description: 'Заголовок объявления',
            type: ApplicationCommandOptionType.String,
            required: false, // Сделали необязательным ради JSON режима
        },
        {
            name: 'description',
            description: 'Основной текст объявления (используйте \\n для переноса строки)',
            type: ApplicationCommandOptionType.String,
            required: false, // Сделали необязательным ради JSON режима
        },
        {
            name: 'channel',
            description: 'Канал для отправки (если пусто — отправит в текущий)',
            type: ApplicationCommandOptionType.Channel,
            channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
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
            description: 'Ссылка на картинку (URL-адрес, заканчивающийся на .png, .jpg, .gif)',
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
    const color = ctx.interaction.options.getString('color') || '#2b2d31';
    const imageUrl = ctx.interaction.options.getString('image');

    const resolvedChannel = ctx.interaction.options.getChannel('channel');
    const targetChannel = resolvedChannel 
        ? ctx.interaction.guild?.channels.cache.get(resolvedChannel.id) 
        : ctx.interaction.channel;

    if (!targetChannel || (targetChannel.type !== ChannelType.GuildText && targetChannel.type !== ChannelType.GuildAnnouncement)) {
        return void await ctx.interaction.editReply({
            content: '❌ **Ошибка:** Целевой канал не найден или не является текстовым/новостийным.'
        });
    }

    try {
        let messagePayload: any = {};

        // === РЕЖИМ 1: ОТПРАВКА ЧЕРЕЗ JSON ===
        if (jsonInput) {
            try {
                const parsedJson = JSON.parse(jsonInput);
                
                // Конструкторы часто отдают объект { messages: [...] } или { embeds: [...] }
                // Приводим к стандартному формату discord.js payload
                messagePayload = parsedJson.messages?.[0] || parsedJson;

                // Защита от пустых сообщений (должен быть либо текст, либо эмбеды)
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
                .setTimestamp();

            if (imageUrl) {
                if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
                    userEmbed.setImage(imageUrl);
                } else {
                    return void await ctx.interaction.editReply({
                        content: '❌ **Ошибка:** Поле `image` должно содержать корректную ссылку.'
                    });
                }
            }

            messagePayload = { embeds: [userEmbed] };
        }

        // Отправка сообщения от лица бота
        await targetChannel.send(messagePayload);

        // Логирование
        const logDetails = jsonInput ? 'Отправлен сложный Embed через JSON' : `Заголовок: ${title}`;
        await sendLog(
            'INFO', 
            'ADMIN-EMBED', 
            `Администратор ${ctx.interaction.user.tag} отправил объявление в <#${targetChannel.id}>\nℹ️ ${logDetails}`
        );

        return void await ctx.interaction.editReply({
            content: `✅ Объявление успешно отправлено в канал <#${targetChannel.id}>!`
        });

    } catch (error: any) {
        await sendLog('ERROR', 'ADMIN-EMBED', `Ошибка отправки эмбеда админом ${ctx.interaction.user.tag}: ${error.message}`);
        return void await ctx.interaction.editReply({
            content: `❌ **Не удалось отправить сообщение.** Проверьте права бота в канале или корректность структуры JSON.`
        });
    }
};