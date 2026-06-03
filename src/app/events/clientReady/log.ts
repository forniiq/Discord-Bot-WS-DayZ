import { initLogger } from '@/app/utils/logger';
import type { EventHandler } from 'commandkit';
import { Logger } from 'commandkit/logger';

const handler: EventHandler<'clientReady'> = async (client) => {
  Logger.info(`Бот Подключился! Имя бота: ${client.user.username}!`);
  initLogger(client);
};

export default handler;
