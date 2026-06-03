import type { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit';
import { ApplicationCommandOptionType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } from 'discord.js';
import crypto from 'crypto';
import { Trade } from '../../models/trades.js'; // Укажите правильный путь к модели

export const metadata: CommandMetadata = {
    guilds: [process.env.GUILD_ID as string]
};

export const command: CommandData = {
    name: 'market',
    description: '📦 Создать объявление на торговой площадке',
    options: [
        {
            name: 'type',
            description: 'Тип вашего объявления',
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
                { name: '💰 Продажа за валюту', value: 'currency' },
                { name: '🔄 Бартер (Обмен вещами)', value: 'barter' }
            ]
        },
        {
            name: 'item',
            description: 'Что вы предлагаете? (например: СВД + 3 мага, Машина Ольга)',
            type: ApplicationCommandOptionType.String,
            required: true,
            max_length: 1000
        },
        {
            name: 'price',
            description: 'Цена в монетах ИЛИ список вещей для бартера',
            type: ApplicationCommandOptionType.String,
            required: true,
            max_length: 1000
        },
        {
            name: 'server',
            description: 'На каком сервере находится лут?',
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
                { name: '🌲 Chernarus', value: 'Chernarus' },
                { name: '❄️ Namalsk', value: 'Namalsk' }
            ]
        },
        {
            name: 'image',
            description: 'Ссылка на скриншот лута (необязательно)',
            type: ApplicationCommandOptionType.String,
            required: false
        }
    ]
};

export const chatInput: ChatInputCommand = async (ctx) => {
    try {
        await ctx.interaction.deferReply({ ephemeral: true });

        const type = ctx.interaction.options.getString('type', true) as 'currency' | 'barter';
        const item = ctx.interaction.options.getString('item', true);
        const price = ctx.interaction.options.getString('price', true);
        const server = ctx.interaction.options.getString('server', true);
        const image = ctx.interaction.options.getString('image');

        if (image && !/^https?:\/\/.+/.test(image)) {
            return void await ctx.interaction.editReply('❌ Некорректная ссылка на изображение. Используйте http/https.');
        }

        const marketChannelId = process.env.MARKET_CHANNEL_ID;
        if (!marketChannelId) {
            return void await ctx.interaction.editReply('❌ Ошибка: В конфигурации (.env) не указан `MARKET_CHANNEL_ID`.');
        }

        const marketChannel = ctx.interaction.guild?.channels.cache.get(marketChannelId);
        if (!marketChannel || marketChannel.type !== ChannelType.GuildText) {
            return void await ctx.interaction.editReply('❌ Канал рынка не найден или не является текстовым.');
        }

        const tradeId = crypto.randomBytes(4).toString('hex'); 
        const originalPriceValue = type === 'currency' ? parseInt(price.replace(/\D/g, '')) || 0 : 0;

        if (type === 'currency' && originalPriceValue <= 0) {
            return void await ctx.interaction.editReply('❌ Для продажи за валюту укажите корректную цену числом.');
        }

        const embed = new EmbedBuilder()
            .setTitle(type === 'currency' ? '💰 ИГРОВОЙ ОФФЕР (ПРОДАЖА)' : '🔄 ИГРОВОЙ ОФФЕР (БАРТЕР)')
            .setDescription(
                `**Сервер:** \`${server}\`\n` +
                `**Продавец:** ${ctx.interaction.user}\n\n` +
                `**Предмет(ы):**\n\`\`\`text\n${item.slice(0, 1000)}\n\`\`\`\n` +
                `**Что хочет взамен:**\n\`\`\`yaml\n${type === 'currency' ? `${originalPriceValue} монет(ы)` : price}\n\`\`\``
            )
            .setColor(type === 'currency' ? '#f1c40f' : '#3498db')
            .setFooter({ text: `ID Сделки: ${tradeId} | СОЮЗ WS` })
            .setTimestamp();

        if (image) embed.setImage(image);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`deal:${tradeId}`)
                .setLabel(type === 'currency' ? '🤝 Купить / Торговаться' : '🤝 Предложить обмен')
                .setStyle(ButtonStyle.Success)
        );

        const marketMessage = await marketChannel.send({ embeds: [embed], components: [row] });

        // Сохраняем в базу данных SQLite
        await Trade.create({
            tradeId,
            messageId: marketMessage.id,
            originalPrice: price,
            currentPrice: originalPriceValue,
            type,
            sellerId: ctx.interaction.user.id,
            buyerId: null,
            sellerConfirmed: false,
            buyerConfirmed: false,
            status: 'active',
            server,
            item
        });

        return void await ctx.interaction.editReply('✅ Ваше объявление успешно выставлено на рынок!');

    } catch (error) {
        console.error('[MARKET COMMAND ERROR]:', error);
        const replyMethod = ctx.interaction.replied || ctx.interaction.deferred ? 'editReply' : 'reply';
        const msg = '❌ Произошла ошибка при создании объявления.';
        
        if (replyMethod === 'editReply') {
            await ctx.interaction.editReply(msg);
        } else {
            await ctx.interaction.reply({ content: msg, ephemeral: true });
        }
    }
};