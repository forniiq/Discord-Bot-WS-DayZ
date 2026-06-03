import type { EventHandler } from 'commandkit';
import { connectDB } from '../../../database/connect';

const handler: EventHandler<'clientReady'> = async (client) => {
    await connectDB();
};

export default handler;