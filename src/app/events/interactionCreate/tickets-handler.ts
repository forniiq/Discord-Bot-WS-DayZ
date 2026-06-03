import type { EventHandler } from 'commandkit';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } from 'discord.js';
import { sendLog } from '@/app/utils/logger';

const CATEGORY_ID = process.env.TICKET_CATEGORY_ID as string;
const ADMIN_ROLES_LIST = (process.env.TICKET_ADMIN_ROLE_ID || '').split(',').map(id => id.trim());

const handler: EventHandler<'interactionCreate'> = async (interaction) => {
    if (!interaction.guild) return;

    // 1. НАЖАТИЕ НА КНОПКУ "ОТКРЫТЬ ТИКЕТ"
    if (interaction.isButton() && interaction.customId === 'ticket_open') {
        await interaction.deferReply({ ephemeral: true });

        const existingChannel = interaction.guild.channels.cache.find(
            (ch) => ch.parentId === CATEGORY_ID && ch.name === `🎫-${interaction.user.username.toLowerCase()}`
        );

        if (existingChannel) {
            return void await interaction.editReply({
                content: `❌ У вас уже есть открытый тикет: <#${existingChannel.id}>. Пожалуйста, используйте его.`
            });
        }

        try {
            const permissionOverwrites = [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] }
            ];

            for (const roleId of ADMIN_ROLES_LIST) {
                if (roleId) {
                    permissionOverwrites.push({
                        id: roleId,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks]
                    });
                }
            }

            const ticketChannel = await interaction.guild.channels.create({
                name: `🎫-${interaction.user.username}`,
                type: ChannelType.GuildText,
                parent: CATEGORY_ID,
                permissionOverwrites
            });

            const welcomeEmbed = new EmbedBuilder()
                .setTitle('🎫 Добро пожаловать в тикет поддержки')
                .setDescription(
                    `Приветствуем, ${interaction.user}!\n\n` +
                    `Пожалуйста, опишите вашу проблему как можно подробнее.\n` +
                    `• Если это **жалоба**, укажите ник нарушителя и прикрепите видео/скриншоты.\n` +
                    `• Если это **баг / пропажа лута**, опишите обстоятельства.\n\n` +
                    `Администрация сервера свяжется с вами прямо в этом чате в ближайшее время.`
                )
                .setColor('#3498db')
                .setTimestamp();

            const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_close')
                    .setLabel('🔒 Закрыть тикет')
                    .setStyle(ButtonStyle.Danger)
            );

            const rolesPingString = ADMIN_ROLES_LIST.map(roleId => `<@&${roleId}>`).join(' ');

            await ticketChannel.send({
                content: `${interaction.user} | ${rolesPingString}`,
                embeds: [welcomeEmbed],
                components: [closeRow]
            });

            await sendLog('INFO', 'TICKETS', `Пользователь ${interaction.user.tag} открыл тикет <#${ticketChannel.id}>.`);

            return void await interaction.editReply({
                content: `✅ Ваш тикет успешно создан: <#${ticketChannel.id}>`
            });

        } catch (error: any) {
            console.error('[TICKET ERROR]', error);
            return void await interaction.editReply({
                content: '❌ Ошибка при создании тикета. Проверьте права бота или ID категории в конфигурации.'
            });
        }
    }

    // 2. НАЖАТИЕ НА КНОПКУ "ЗАКРЫТЬ ТИКЕТ"
    if (interaction.isButton() && interaction.customId === 'ticket_close') {
        await interaction.deferReply();

        const member = await interaction.guild.members.fetch(interaction.user.id);
        const channelName = interaction.channel && 'name' in interaction.channel ? interaction.channel.name || 'ticket' : 'ticket';
        const isAuthor = channelName.includes(interaction.user.username.toLowerCase());
        const isAdmin = ADMIN_ROLES_LIST.some(roleId => member.roles.cache.has(roleId));

        if (!isAuthor && !isAdmin) {
            return void await interaction.editReply({
                content: '❌ Вы не можете закрыть этот тикет, так как вы не являетесь его автором или администратором.'
            });
        }

        await interaction.editReply({
            content: '⚠️ **Тикет будет удален через 5 секунд.** Спасибо за обращение!'
        });

        await sendLog('WARN', 'TICKETS', `Тикет #${channelName} был закрыт пользователем ${interaction.user.tag}.`);

        setTimeout(() => {
            interaction.channel?.delete().catch(() => null);
        }, 5000);
    }
};

export default handler;