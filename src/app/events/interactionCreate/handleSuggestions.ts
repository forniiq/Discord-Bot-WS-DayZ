import { 
    Interaction, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    EmbedBuilder,
    PermissionFlagsBits
} from 'discord.js';

export default async (interaction: Interaction) => {
    if (interaction.isButton() && interaction.customId.startsWith('suggest_manage_')) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ 
                content: '❌ У вас нет прав Администратора для управления предложениями!', 
                ephemeral: true 
            });
        }

        const [, , authorId, pollMessageId] = interaction.customId.split('_');

        // Создаем форму вердикта
        const modal = new ModalBuilder()
            .setCustomId(`suggest_modal_${authorId}_${pollMessageId || 'none'}`)
            .setTitle('Вердикт по предложению');

        const statusInput = new TextInputBuilder()
            .setCustomId('suggest_status')
            .setLabel('Выберите статус предложения') 
            .setPlaceholder('Введите цифру: 1 - Принято, 2 - Отклонено, 3 - В процессе')
            .setMinLength(1)
            .setMaxLength(1)
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const reasonInput = new TextInputBuilder()
            .setCustomId('suggest_reason')
            .setLabel('ВЕРДИКТ АДМИНИСТРАЦИИ')
            .setPlaceholder('Напишите комментарий или причину решения...')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(statusInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput)
        );

        await interaction.showModal(modal);
        return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('suggest_modal_')) {
        await interaction.deferReply({ ephemeral: true });

        const [, , authorId, pollMessageId] = interaction.customId.split('_');
        const statusType = interaction.fields.getTextInputValue('suggest_status').trim();
        const reason = interaction.fields.getTextInputValue('suggest_reason');

        const mainMessage = interaction.message;
        if (!mainMessage || mainMessage.embeds.length === 0) {
            return interaction.editReply({ content: '❌ Главное сообщение предложения не найдено.' });
        }

        let statusText = '❌ Отклонено';
        let embedColor = '#e74c3c';

        if (statusType === '1') {
            statusText = '✅ Принято / Будет добавлено';
            embedColor = '#2ecc71';
        } else if (statusType === '3') {
            statusText = '⚙️ В процессе реализации';
            embedColor = '#3498db';
        } else if (statusType !== '2') {
            return interaction.editReply({ content: '⚠️ Неверный статус! Введите цифру от 1 до 3.' });
        }

        const oldEmbed = mainMessage.embeds[0];
        if (!oldEmbed) {
            return interaction.editReply({ content: '❌ Ошибка: В сообщении отсутствует карточка предложения.' });
        }

        const updatedEmbed = EmbedBuilder.from(oldEmbed)
            .setColor(embedColor as any)
            .setFields([
                { name: '👤 Автор', value: `<@${authorId}>`, inline: true },
                { name: '📊 Статус', value: statusText, inline: true },
                { name: '👑 Ответ Администрации', value: reason, inline: false }
            ]);

        await mainMessage.edit({
            content: `📢 Решение вынесено! Игрок <@${authorId}> получил ответ от администрации.`,
            embeds: [updatedEmbed],
            components: []
        });

        if (pollMessageId && pollMessageId !== 'none') {
            try {
                const pollMessage = await interaction.channel?.messages.fetch(pollMessageId);
                if (pollMessage && pollMessage.poll) {
                    await pollMessage.poll.end(); 
                }
            } catch (error) {
                console.error('Не удалось автоматически завершить опрос:', error);
            }
        }

        return interaction.editReply({ content: '✅ Вердикт успешно зафиксирован, опрос завершен!' });
    }
};