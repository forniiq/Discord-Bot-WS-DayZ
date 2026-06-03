import { Client } from 'discord.js';

const client = new Client({
  intents: [
    'Guilds', 
    'GuildMembers', 
    'GuildMessages', 
    'MessageContent',
    'GuildVoiceStates'
  ],
});

export default client;