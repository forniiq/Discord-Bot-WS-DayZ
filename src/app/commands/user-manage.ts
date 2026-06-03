import type { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit';
import { ApplicationCommandOptionType } from 'discord.js';
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
            name: 'action',
            description: 'Тип выполняемой операции',
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
                { name: 'Запросить данные', value: 'get' },
                { name: 'Изменить данные', value: 'set' },
            ],
        },
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
            required: false,
        },
    ],
};

export const chatInput: ChatInputCommand = async (ctx) => {
    await ctx.interaction.deferReply({ ephemeral: true });

    const action = ctx.interaction.options.getString('action', true);
    const targetUser = ctx.interaction.options.getUser('target-user', true);
    const field = ctx.interaction.options.getString('field', true) as AllowedFields;
    const valueInput = ctx.interaction.options.getString('value');

    try {
        const [user] = await User.findOrCreate({
            where: { discordId: targetUser.id },
        });

        const currentValue = Number(user[field]) || 0;

        // РЕЖИМ: ПОЛУЧЕНИЕ ДАННЫХ
        if (action === 'get') {
            return void await ctx.interaction.editReply({
                content: `>>> **ИНФОРМАЦИЯ О ПОЛЬЗОВАТЕЛЕ**\n• **Пользователь:** ${targetUser}\n• **Параметр:** \`${field}\`\n• **Текущее значение:** \`${currentValue}\``
            });
        }

        // РЕЖИМ: ИЗМЕНЕНИЕ ДАННЫХ
        if (action === 'set') {
            if (!valueInput) {
                return void await ctx.interaction.editReply({
                    content: '❌ **Ошибка запроса:** Для изменения данных необходимо заполнить поле `value`.'
                });
            }

            let newValue = 0;
            const cleanInput = valueInput.trim();

            // Проверка на использование математических модификаторов (+, -, *, /)
            const match = cleanInput.match(/^([+\-*/])\s*(\d+)$/);

            if (match) {
                const operator = match[1];
                const modifierValue = parseInt(match[2]!, 10);

                if (operator === '/' && modifierValue === 0) {
                    return void await ctx.interaction.editReply({
                        content: '❌ **Ошибка вычислений:** Деление на ноль невозможно.'
                    });
                }

                // Математические операции на основе оператора
                switch (operator) {
                    case '+': newValue = currentValue + modifierValue; break;
                    case '-': newValue = currentValue - modifierValue; break;
                    case '*': newValue = currentValue * modifierValue; break;
                    case '/': newValue = Math.floor(currentValue / modifierValue); break;
                }
            } else {
                // Если передан не модификатор, а статичное число
                newValue = parseInt(cleanInput, 10);

                if (isNaN(newValue)) {
                    return void await ctx.interaction.editReply({
                        content: '❌ **Ошибка валидации:** Неверный формат ввода. Используйте числа или модификаторы (`+500`, `-100`, `*2`, `/5`).'
                    });
                }
            }

            // Защита от отрицательных значений для убийств и опыта
            if ((field === 'kills' || field === 'exp') && newValue < 0) {
                newValue = 0;
            }

            // Сохранение изменений в базу данных
            user[field] = newValue;
            await user.save();

            await sendLog('WARN', 'DB-MANAGE', `Админ ${ctx.interaction.user.tag} изменил данные игрока ${targetUser.tag}.\nПоле: ${field}\nБыло: ${currentValue} -> Стало: ${newValue} (Ввод: "${valueInput}")`);

            return void await ctx.interaction.editReply({
                content: `>>> **ИЗМЕНЕНИЕ БАЗЫ ДАННЫХ УСПЕШНО ЗАВЕРШЕНО**\n• **Пользователь:** ${targetUser}\n• **Параметр:** \`${field}\`\n• **Прежнее значение:** \`${currentValue}\` ➡️ **Новое значение:** \`${newValue}\``
            });
        }

    } catch (error) {
        Logger.error(`[DATABASE ERROR] Ошибка в модуле db-manage: ${error}`);
        await ctx.interaction.editReply({
            content: '❌ **Критическая ошибка:** Не удалось выполнить операцию с базой данных.',
        });
    }
};