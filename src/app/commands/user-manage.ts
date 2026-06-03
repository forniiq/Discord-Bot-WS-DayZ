import type { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit';
import { ApplicationCommandOptionType, EmbedBuilder } from 'discord.js';
import { User } from '../../models/users';
import { sendLog } from '@/app/utils/logger';
import { Logger } from 'commandkit/logger';

type AllowedFields = 'money' | 'kills' | 'exp';

export const metadata: CommandMetadata = {
    userPermissions: 'Administrator',
    guilds: [process.env.GUILD_ID as string]
};

export const command: CommandData = {
    name: 'user-manage',
    description: '💽 Управление базой данных игроков',
    options: [
        {
            name: 'get',
            description: '🔎 Запросить данные игрока из базы',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'target-user',
                    description: 'Целевой пользователь',
                    type: ApplicationCommandOptionType.User,
                    required: true,
                },
                {
                    name: 'field',
                    description: 'Выбираемый параметр',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                        { name: 'Баланс (money)', value: 'money' },
                        { name: 'Убийства (kills)', value: 'kills' },
                        { name: 'Опыт (exp)', value: 'exp' },
                    ],
                }
            ]
        },
        {
            name: 'set',
            description: '✍️ Изменить данные игрока в базе',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'target-user',
                    description: 'Целевой пользователь',
                    type: ApplicationCommandOptionType.User,
                    required: true,
                },
                {
                    name: 'field',
                    description: 'Выбираемый параметр',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                        { name: 'Баланс (money)', value: 'money' },
                        { name: 'Убийства (kills)', value: 'kills' },
                        { name: 'Опыт (exp)', value: 'exp' },
                    ],
                },
                {
                    name: 'value',
                    description: 'Значение или модификатор (Пример: 1000, +500, -100, *2, /3)',
                    type: ApplicationCommandOptionType.String,
                    required: true, // Теперь поле ВСЕГДА обязательно в режиме изменения!
                }
            ]
        }
    ],
};

export const chatInput: ChatInputCommand = async (ctx) => {
    await ctx.interaction.deferReply({ ephemeral: true });

    const subcommand = ctx.interaction.options.getSubcommand(true);
    const targetUser = ctx.interaction.options.getUser('target-user', true);
    const field = ctx.interaction.options.getString('field', true) as AllowedFields;

    try {
        const [user] = await User.findOrCreate({
            where: { discordId: targetUser.id },
        });

        // Безопасное чтение динамического поля из модели
        const currentValue = Number((user as any)[field]) || 0;

        // Создаем базовый красивый эмбед для ответа
        const responseEmbed = new EmbedBuilder()
            .setTimestamp()
            .setFooter({ text: `Операцию выполнил: ${ctx.interaction.user.username}` });

        // === РЕЖИМ: ПОЛУЧЕНИЕ ДАННЫХ ===
        if (subcommand === 'get') {
            responseEmbed
                .setTitle('🔎 Данные игрока найдены')
                .setColor('#3498db')
                .setDescription(
                    `• **Пользователь:** ${targetUser} (${targetUser.tag})\n` +
                    `• **Параметр базы:** \`${field}\`\n` +
                    `• **Текущее значение:** \`${currentValue.toLocaleString('ru-RU')}\``
                );

            return void await ctx.interaction.editReply({ embeds: [responseEmbed] });
        }

        // === РЕЖИМ: ИЗМЕНЕНИЕ ДАННЫХ ===
        if (subcommand === 'set') {
            const valueInput = ctx.interaction.options.getString('value', true).trim();
            
            let newValue = 0;
            const match = valueInput.match(/^([+\-*/])\s*(\d+)$/);

            if (match) {
                const operator = match[1];
                const modifierValue = parseInt(match[2]!, 10);

                if (operator === '/' && modifierValue === 0) {
                    return void await ctx.interaction.editReply({
                        content: '❌ **Ошибка вычислений:** Деление на ноль невозможно.'
                    });
                }

                switch (operator) {
                    case '+': newValue = currentValue + modifierValue; break;
                    case '-': newValue = currentValue - modifierValue; break;
                    case '*': newValue = currentValue * modifierValue; break;
                    case '/': newValue = Math.floor(currentValue / modifierValue); break;
                }
            } else {
                // Если передано просто число (проверяем, что нет лишних букв и символов)
                if (!/^\d+$/.test(valueInput)) {
                    return void await ctx.interaction.editReply({
                        content: '❌ **Ошибка валидации:** Неверный формат ввода. Используйте только целые числа или модификаторы (`+500`, `-100`, `*2`, `/5`).'
                    });
                }
                newValue = parseInt(valueInput, 10);
            }

            // Универсальная защита: ни один игровой параметр не должен уходить в минус
            if (newValue < 0) {
                newValue = 0;
            }

            // Защита от переполнения (максимум 99 миллиардов, чтобы не сломать типы данных БД)
            if (newValue > 99_999_999_999) {
                return void await ctx.interaction.editReply({
                    content: '❌ **Ошибка лимита:** Новое значение слишком велико.'
                });
            }

            // Сохранение изменений
            (user as any)[field] = newValue;
            await user.save();

            // Логирование действия администратора
            await sendLog(
                'WARN', 
                'DB-MANAGE', 
                `Админ ${ctx.interaction.user.tag} изменил данные игрока ${targetUser.tag}.\nПоле: ${field}\nБыло: ${currentValue} -> Стало: ${newValue} (Ввод: "${valueInput}")`
            );

            responseEmbed
                .setTitle('✅ База данных успешно обновлена')
                .setColor('#2ecc71')
                .setDescription(
                    `• **Пользователь:** ${targetUser} (${targetUser.tag})\n` +
                    `• **Измененный параметр:** \`${field}\`\n\n` +
                    `• **Было значение:** \`${currentValue.toLocaleString('ru-RU')}\`\n` +
                    `• **Стало значение:** \`${newValue.toLocaleString('ru-RU')}\``
                );

            return void await ctx.interaction.editReply({ embeds: [responseEmbed] });
        }

    } catch (error) {
        Logger.error(`[DATABASE ERROR] Ошибка в модуле user-manage: ${error}`);
        return void await ctx.interaction.editReply({
            content: '❌ **Критическая ошибка:** Не удалось выполнить операцию. Проблема с доступом к базе данных.',
        });
    }
};