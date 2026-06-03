import type { ChatInputCommand, MessageCommand, CommandData } from 'commandkit';

export const command: CommandData = {
  name: 'ping',
  description: "⏱️ Узнать задержку бота.",
};

export const chatInput: ChatInputCommand = async (ctx) => {
  const latency = (ctx.client.ws.ping ?? -1).toString();
  const response = `Pong! Задержка: ${latency}мс`;

  await ctx.interaction.reply(response);
};

export const message: MessageCommand = async (ctx) => {
  const latency = (ctx.client.ws.ping ?? -1).toString();
  const response = `Pong! Latency: ${latency}ms`;

  await ctx.message.reply(response);
};
