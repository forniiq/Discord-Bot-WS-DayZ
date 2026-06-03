import type { EventHandler } from 'commandkit';
import { 
    ChannelType, 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    GuildTextBasedChannel
} from 'discord.js';
import { User } from '../../../models/users.js';
import { Trade } from '../../../models/trades.ts';

const ADMIN_ROLE_ID = process.env.TICKET_ADMIN_ROLE_ID?.trim() || null;
const TRADES_CATEGORY_ID = process.env.TICKET_CATEGORY_ID?.trim() || null;
const MARKET_CHANNEL_ID = process.env.MARKET_CHANNEL_ID?.trim() || null;

function buildTradeEmbedDescription(trade: Trade): string {
    return `**Продавец:** <@${trade.sellerId}>\n` +
           `**Покупатель:** <@${trade.buyerId}>\n` +
           `**Тип сделки:** ${trade.type === 'currency' ? '💰 Валютный расчет' : '🔄 Бартерный обмен'}\n` +
           `**Предмет(ы):**\n\`\`\`text\n${trade.item}\n\`\`\`\n` +
           (trade.type === 'currency' 
               ? `**Начальная цена:** \`${trade.originalPrice} монет\`\n**Текущая согласованная цена:** \`${trade.currentPrice} монет\`\n\n` 
               : `**Требуемый бартер:**\n\`\`\`yaml\n${trade.originalPrice}\n\`\`\`\n`) +
           `*Обсудите детали и нажмите "Подтвердить готовность" для завершения.*`;
}

async function archiveMarketMessage(guild: any, session: Trade, buyerId: string) {
    if (!MARKET_CHANNEL_ID) return;
    try {
        const marketChannel = guild.channels.cache.get(MARKET_CHANNEL_ID) as GuildTextBasedChannel;
        if (!marketChannel) return;

        const msg = await marketChannel.messages.fetch(session.messageId).catch(() => null);
        if (msg && msg.embeds[0]) {
            const archivedEmbed = EmbedBuilder.from(msg.embeds[0])
                .setTitle(session.type === 'currency' ? '❌ ТОВАР ПРОДАН' : '❌ ОБМЕН ЗАВЕРШЕН')
                .setColor('#7f8c8d')
                .addFields({ name: '📊 Статус', value: `Продано игроку <@${buyerId}>`, inline: false });

            await msg.edit({ embeds: [archivedEmbed], components: [] });
        }
    } catch (e) {
        console.warn('[MARKET ARCHIVE ERROR]: Не удалось обновить пост на рынке:', e);
    }
}

const handler: EventHandler<'interactionCreate'> = async (interaction) => {
    if (!interaction.guild) return;

    const parseCustomId = (id: string) => {
        const [action, tradeId] = id.split(':');
        return { action, tradeId };
    };

    const { action, tradeId } = (interaction.isButton() || interaction.isModalSubmit()) 
        ? parseCustomId(interaction.customId) 
        : { action: null, tradeId: null };

    if (!tradeId) return;

    // 1️⃣ Кнопка "Купить / Обменять" на рынке
    if (interaction.isButton() && action === 'deal') {
        try {
            await interaction.deferReply({ ephemeral: true });

            const trade = await Trade.findByPk(tradeId);
            if (!trade || trade.status !== 'active') {
                return void await interaction.editReply('❌ Это объявление больше не активно, товар продан или сделка отменена.');
            }

            if (interaction.user.id === trade.sellerId) {
                return void await interaction.editReply('❌ Вы не можете торговать с самим собой.');
            }

            if (trade.buyerId) {
                return void await interaction.editReply('❌ У этого объявления уже есть покупатель.');
            }

            trade.buyerId = interaction.user.id;
            await trade.save();

            const overwrites = [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: trade.sellerId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] }
            ];

            if (ADMIN_ROLE_ID && interaction.guild.roles.cache.has(ADMIN_ROLE_ID)) {
                overwrites.push({ 
                    id: ADMIN_ROLE_ID, 
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] 
                });
            }

            const tradeChannel = await interaction.guild.channels.create({
                name: `🤝-${interaction.user.username.slice(0, 10)}-${tradeId}`,
                type: ChannelType.GuildText,
                parent: TRADES_CATEGORY_ID || undefined,
                permissionOverwrites: overwrites,
                reason: `Сделка по оферу ${tradeId}`
            });

            const embed = new EmbedBuilder()
                .setTitle('🤝 Комната переговоров и сделки')
                .setDescription(buildTradeEmbedDescription(trade))
                .setColor('#2ecc71')
                .setTimestamp();

            const actionRow = new ActionRowBuilder<ButtonBuilder>();
            
            if (trade.type === 'currency') {
                actionRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`changeprice:${tradeId}`)
                        .setLabel('✍️ Изменить цену')
                        .setStyle(ButtonStyle.Secondary)
                );
            }

            actionRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`confirm:${tradeId}`)
                    .setLabel('✅ Подтвердить готовность')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`cancel:${tradeId}`)
                    .setLabel('❌ Отменить сделку')
                    .setStyle(ButtonStyle.Danger)
            );

            if (ADMIN_ROLE_ID) {
                actionRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`adminforce:${tradeId}`)
                        .setLabel('⚡ Завершить (Admin)')
                        .setStyle(ButtonStyle.Primary)
                );
            }

            await tradeChannel.send({
                content: `<@${trade.sellerId}> | ${interaction.user} | *Администрация — гарант.*`,
                embeds: [embed],
                components: [actionRow]
            });

            return void await interaction.editReply(`✅ Комната создана: <#${tradeChannel.id}>`);

        } catch (error) {
            console.error('[MARKET DEAL ERROR]:', error);
            if (interaction.deferred) await interaction.editReply('❌ Ошибка при инициализации сделки.');
        }
    }

    // 2️⃣ Кнопка открытия модалки смены цены
    if (interaction.isButton() && action === 'changeprice') {
        const trade = await Trade.findByPk(tradeId);
        if (!trade || trade.type !== 'currency' || trade.status !== 'active') {
            return void await interaction.reply({ content: '❌ Изменение цены недоступно.', ephemeral: true });
        }

        if (interaction.user.id !== trade.sellerId && interaction.user.id !== trade.buyerId) {
            return void await interaction.reply({ content: '❌ Вы не участник сделки.', ephemeral: true });
        }

        const modal = new ModalBuilder()
            .setCustomId(`modalprice:${tradeId}`)
            .setTitle('Изменение стоимости');
        
        const priceInput = new TextInputBuilder()
            .setCustomId('new_price_value')
            .setLabel('Новая цена (в монетах):')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Пример: 5000')
            .setMinLength(1)
            .setMaxLength(10)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(priceInput));
        return void await interaction.showModal(modal);
    }

    // 3️⃣ Отправка модалки изменения цены
    if (interaction.isModalSubmit() && action === 'modalprice') {
        try {
            await interaction.deferReply();
            const trade = await Trade.findByPk(tradeId);
            if (!trade || trade.status !== 'active') return void await interaction.editReply('❌ Сделка не найдена.');

            const rawPrice = interaction.fields.getTextInputValue('new_price_value');
            const newPrice = parseInt(rawPrice.replace(/\D/g, '')); 

            if (isNaN(newPrice) || newPrice <= 0 || newPrice > 999999999) {
                return void await interaction.editReply('❌ Недопустимая сумма.');
            }

            trade.currentPrice = newPrice;
            trade.sellerConfirmed = false;
            trade.buyerConfirmed = false;
            await trade.save();

            const channel = interaction.channel;
            if (channel && 'messages' in channel) {
                const lastMessage = await channel.messages.fetch({ limit: 1 });
                const msg = lastMessage.first();
                
                if (msg && msg.embeds.length > 0 && msg.embeds[0]) {
                    const updatedEmbed = EmbedBuilder.from(msg.embeds[0])
                        .setDescription(buildTradeEmbedDescription(trade))
                        .setTimestamp();
                    await msg.edit({ embeds: [updatedEmbed] });
                }
            }

            return void await interaction.editReply(`📢 **Цена обновлена на:** \`${newPrice} монет\`. Подтверждения сброшены.`);
        } catch (error) {
            console.error('[MODAL PRICE ERROR]:', error);
            if (interaction.deferred) await interaction.editReply('❌ Ошибка обновления цены.');
        }
    }

    // 4️⃣ Кнопка подтверждения сделки сторонами
    if (interaction.isButton() && action === 'confirm') {
        try {
            await interaction.deferReply();
            const trade = await Trade.findByPk(tradeId);
            if (!trade || trade.status !== 'active') return void await interaction.editReply('❌ Сделка завершена или неактивна.');

            if (interaction.user.id === trade.sellerId) trade.sellerConfirmed = true;
            else if (interaction.user.id === trade.buyerId) trade.buyerConfirmed = true;
            else return void await interaction.editReply('❌ Вы не имеете отношения к этой сделке.');

            await trade.save();

            if (trade.sellerConfirmed && trade.buyerConfirmed && trade.buyerId) {
                trade.status = 'processing';
                await trade.save();

                if (trade.type === 'currency') {
                    try {
                        const [buyer] = await User.findOrCreate({ where: { discordId: trade.buyerId } });
                        const [seller] = await User.findOrCreate({ where: { discordId: trade.sellerId } });

                        const buyerMoney = Number(buyer.money) || 0;
                        if (buyerMoney < trade.currentPrice) {
                            trade.status = 'active';
                            trade.sellerConfirmed = false;
                            trade.buyerConfirmed = false;
                            await trade.save();
                            return void await interaction.editReply(`❌ Нехватка средств у покупателя. Баланс: \`${buyerMoney}\`.`);
                        }

                        buyer.money = buyerMoney - trade.currentPrice;
                        seller.money = (Number(seller.money) || 0) + trade.currentPrice;
                        
                        await buyer.save();
                        await seller.save();

                        await archiveMarketMessage(interaction.guild, trade, trade.buyerId);

                        trade.status = 'closed';
                        await trade.save(); // Мягкое закрытие в БД

                        const channel = interaction.channel;
                        if (channel && 'send' in channel) {
                            await interaction.message.edit({ components: [] }).catch(() => {});
                            await channel.send({
                                content: `🎉 **Сделка успешно завершена!**\n<@${trade.buyerId}> перевёл <@${trade.sellerId}> \`${trade.currentPrice} монет\`.`,
                                embeds: [new EmbedBuilder().setDescription('✅ Канал будет удален автоматически через 15 секунд.').setColor('#27ae60')]
                            });
                            setTimeout(() => channel.delete().catch(() => {}), 15000);
                        }
                    } catch (err) {
                        trade.status = 'active';
                        await trade.save();
                        console.error('[TRANSACTION ERROR]:', err);
                        return void await interaction.editReply('❌ Ошибка транзакции базы данных.');
                    }
                } else {
                    // Бартерная сделка
                    await archiveMarketMessage(interaction.guild, trade, trade.buyerId);
                    
                    trade.status = 'closed';
                    await trade.save();

                    const channel = interaction.channel;
                    if (channel && 'send' in channel) {
                        await interaction.message.edit({ components: [] }).catch(() => {});
                        await channel.send({
                            content: `🤝 **Бартер подтвержден сторонами!**\nОбмен между <@${trade.buyerId}> и <@${trade.sellerId}> состоялся.`,
                            embeds: [new EmbedBuilder().setDescription('✅ Канал закроется через 15 секунд.').setColor('#3498db')]
                        });
                        setTimeout(() => channel.delete().catch(() => {}), 15000);
                    }
                }
                return;
            }

            const pendingId = trade.sellerConfirmed ? (trade.buyerId ?? 'покупатель') : trade.sellerId;
            return void await interaction.editReply(`✅ Готовность зафиксирована. Ожидаем подтверждения от <@${pendingId}>.`);
        } catch (error) {
            console.error('[CONFIRM ERROR]:', error);
            if (interaction.deferred) await interaction.editReply('❌ Ошибка регистрации готовности.');
        }
    }

    // 5️⃣ Кнопка отмены сделки участником
    if (interaction.isButton() && action === 'cancel') {
        try {
            await interaction.deferReply();
            const trade = await Trade.findByPk(tradeId);
            
            if (trade) {
                if (interaction.user.id !== trade.sellerId && interaction.user.id !== trade.buyerId) {
                    return void await interaction.editReply('❌ Вы не можете отменить эту операцию.');
                }
                trade.status = 'closed';
                await trade.save();
            }
            
            const channel = interaction.channel;
            if (channel && 'send' in channel) {
                await interaction.message.edit({ components: [] }).catch(() => {});
                await channel.send('⚠️ Сделка аннулирована участником. Комната удалится через 5 секунд.');
            }
            setTimeout(() => channel?.delete().catch(() => {}), 5000);
            return void await interaction.editReply('❌ Сделка отменена.');
        } catch (error) {
            console.error('[CANCEL ERROR]:', error);
        }
    }

    // 6️⃣ Кнопка принудительного закрытия администратором
    if (interaction.isButton() && action === 'adminforce') {
        try {
            await interaction.deferReply();
            if (!ADMIN_ROLE_ID) return void await interaction.editReply('❌ Права администратора не настроены.');
            
            const member = await interaction.guild.members.fetch(interaction.user.id);
            if (!member.roles.cache.has(ADMIN_ROLE_ID)) {
                return void await interaction.editReply('❌ Действие доступно только администрации.');
            }

            const trade = await Trade.findByPk(tradeId);
            if (!trade || !trade.buyerId || trade.status === 'closed') {
                return void await interaction.editReply('❌ Сделка неактивна или отсутствует покупатель.');
            }

            trade.status = 'processing';
            await trade.save();

            if (trade.type === 'currency') {
                try {
                    const [buyer] = await User.findOrCreate({ where: { discordId: trade.buyerId } });
                    const [seller] = await User.findOrCreate({ where: { discordId: trade.sellerId } });

                    buyer.money = (Number(buyer.money) || 0) - trade.currentPrice;
                    seller.money = (Number(seller.money) || 0) + trade.currentPrice;
                    
                    await buyer.save();
                    await seller.save();
                } catch (e) {
                    trade.status = 'active';
                    await trade.save();
                    console.error('[ADMIN FORCE DB ERROR]:', e);
                    return void await interaction.editReply('❌ Критическая ошибка БД.');
                }
            }

            await archiveMarketMessage(interaction.guild, trade, trade.buyerId);
            
            trade.status = 'closed';
            await trade.save();

            const channel = interaction.channel;
            if (channel && 'send' in channel) {
                await interaction.message.edit({ components: [] }).catch(() => {});
                await channel.send({
                    content: `⚡ **Администратор <@${interaction.user.id}> принудительно закрыл сделку!**`,
                    embeds: [new EmbedBuilder()
                        .setDescription(trade.type === 'currency' 
                            ? `💸 Транзакция проведена: \`${trade.currentPrice} монет\`.` 
                            : '🤝 Обмен одобрен и зафиксирован.')
                        .setColor('#e74c3c')]
                });
                setTimeout(() => channel.delete().catch(() => {}), 10000);
            }
            return void await interaction.editReply('✅ Администратор успешно закрыл сделку.');
        } catch (error) {
            console.error('[ADMIN FORCE ERROR]:', error);
        }
    }
};

export default handler;