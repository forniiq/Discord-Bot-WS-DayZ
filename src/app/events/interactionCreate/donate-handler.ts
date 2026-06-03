import type { EventHandler } from 'commandkit';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } from 'discord.js';
import { Donation } from '../../../models/donations.js';
import { sendLog } from '@/app/utils/logger';
import { Logger } from 'commandkit/logger';

const CATEGORY_ID = process.env.DONATE_CATEGORY_ID as string; 
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID as string;       

const handler: EventHandler<'interactionCreate'> = async (interaction) => {
    if (!interaction.guild) return;

    // 1. ОБРАБОТКА ВЫБОРА В ВЫПАДАЮЩЕМ МЕНЮ
    if (interaction.isStringSelectMenu() && interaction.customId === 'donate_select') {
        await interaction.deferReply({ ephemeral: true });

        const [itemKey, priceStr] = interaction.values[0]!.split('_');
        const price = parseInt(priceStr || '0', 10);
        
        const rawInteraction = interaction as any;
        const itemName = rawInteraction.component?.options?.find((o: any) => o.value === interaction.values[0])?.label || 'Товар';

        const guild = interaction.guild;

        try {
            await guild.members.fetch(interaction.user.id).catch(() => null);
            if (ADMIN_ROLE_ID) {
                await guild.roles.fetch(ADMIN_ROLE_ID).catch(() => null);
            }

            const overwrites: any[] = [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }
            ];

            if (guild.members.cache.has(interaction.user.id)) {
                overwrites.push({ 
                    id: interaction.user.id, 
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] 
                });
            } else {
                overwrites.push({
                    id: interaction.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                });
            }

            const hasAdminRole = ADMIN_ROLE_ID && guild.roles.cache.has(ADMIN_ROLE_ID);
            if (hasAdminRole) {
                overwrites.push({ 
                    id: ADMIN_ROLE_ID, 
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] 
                });
            } else {
                Logger.warn(`[DONATE WARNING] Роль админа "${ADMIN_ROLE_ID}" не найдена на сервере! Создаем канал без нее.`);
            }

            const ticketChannel = await guild.channels.create({
                name: `💸-${interaction.user.username}`,
                type: ChannelType.GuildText,
                parent: CATEGORY_ID || null,
                permissionOverwrites: overwrites 
            });

            await Donation.upsert({
                id: ticketChannel.id,
                userId: interaction.user.id,
                itemName: itemName,
                price: price,
                status: 'pending'
            }).catch(err => Logger.error(`[DB ERROR] Не удалось сохранить донат: ${err}`));

            const ticketEmbed = new EmbedBuilder()
                .setTitle('🛒 Новая заявка на донат')
                .setColor('#2b2d31')
                .setDescription(`Пользователь <@${interaction.user.id}> хочет приобрести:\n**${itemName}** за **${price} руб.**\n\n💬 Администрация скоро отправит реквизиты для оплаты прямо в этот чат. Ожидайте.`)
                .setTimestamp();

            const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('donate_confirm').setLabel('✅ Подтвердить оплату (Админ)').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('donate_cancel').setLabel('❌ Закрыть тикет').setStyle(ButtonStyle.Danger)
            );

            const adminPing = hasAdminRole ? `<@&${ADMIN_ROLE_ID}>` : `@Admin (Роль не найдена)`;
            
            await ticketChannel.send({ 
                content: `<@${interaction.user.id}> | ${adminPing}`, 
                embeds: [ticketEmbed], 
                components: [buttons] 
            });
            
            await sendLog('INFO', 'DONATE-SHOP', `🛒 Пользователь ${interaction.user.tag} открыл тикет <#${ticketChannel.id}> на покупку: "${itemName}" за ${price} руб.`);

            return void await interaction.editReply({ content: `✅ Канал для оплаты успешно создан: <#${ticketChannel.id}>` });
        } catch (error) {
            Logger.error(`[DONATE] Ошибка при создании тикета: ${error}`);
            return void await interaction.editReply({ content: '❌ Произошла ошибка при создании канала оплаты. Обратитесь к администратору.' });
        }
    }

    // 2. ОБРАБОТКА НАЖАТИЯ НА КНОПКИ ВНУТРИ ТИКЕТА
    if (interaction.isButton()) {
        const donation = await Donation.findByPk(interaction.channelId);
        if (!donation) return; 

        // Кнопка: Подтвердить оплату
        if (interaction.customId === 'donate_confirm') {
            const member = await interaction.guild?.members.fetch(interaction.user.id);
            
            if (!ADMIN_ROLE_ID || !member?.roles.cache.has(ADMIN_ROLE_ID)) {
                return void await interaction.reply({ content: '❌ У вас нет прав для подтверждения оплаты.', ephemeral: true });
            }

            await interaction.deferReply();

            donation.status = 'paid';
            await donation.save();

            await interaction.editReply({ content: `🎉 **Оплата успешно подтверждена админом ${interaction.user}!**\nТовар **${donation.itemName}** зачтен. Этот канал закроется через 10 секунд.` });
            
            const buyer = await interaction.client.users.fetch(donation.userId).catch(() => null);
            if (buyer) {
                buyer.send(`✅ Ваша оплата товара **${donation.itemName}** успешно подтверждена! Спасибо за поддержку Union WS.`).catch(() => null);
            }

            await sendLog('WARN', 'DONATE-SHOP', `💰 [ОПЛАТА] Администратор ${interaction.user.tag} подтвердил оплату товара "${donation.itemName}" (${donation.price} руб.) для игрока с ID: ${donation.userId}. Тикет удален.`);

            setTimeout(() => void interaction.channel?.delete().catch(() => null), 10000);
            return;
        }

        // Кнопка: Отмена / Закрытие тикета
        if (interaction.customId === 'donate_cancel') {
            await interaction.reply({ content: '⚙️ Закрытие тикета и удаление данных...' });
            
            donation.status = 'cancelled';
            await donation.save();

            await sendLog('INFO', 'DONATE-SHOP', `❌ Тикет доната #${interaction.channelId} закрыт/отменен пользователем ${interaction.user.tag}.`);

            setTimeout(() => void interaction.channel?.delete().catch(() => null), 3000);
            return;
        }
    }
};

export default handler;