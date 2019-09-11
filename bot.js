/*
  @title        Cummy 2.0
  @description  Re-code of Cummy to be used on the Dank Memes server
  @author       William Moody (@bmdyy#0068)
  @date         10.09.2019
*/

// --- --- --- IMPORTS --- --- ---

const Discord = require('discord.js'); // discord api (https://discord.js.org)
const PGClient = require('pg').Client; // postgresql (db)
const http = require('http'); // http requests (for the heartbeat)

// --- --- --- VARS --- --- ---

const KEEPALIVE_URL = "http://cummy2.herokuapp.com"; // url to ping cummy
const KEEPALIVE_INTERVAL = 5 * 60 * 1000; // in milliseconds
const PRESENCE = {status:'idle',game:{type:'LISTENING',name:'Trance - 009 Sound System Dreamscape (HD)'}}; // type PresenceData
const VOTES = [ // {emoji name, value, reacted by default}
  {name:'👎', id:'👎', value:-1, isDefault:true},
  {name:'👍', id:'👍', value:1, isDefault:true},
  {name:'🔥', id:'🔥', value:5, isDefault:false},
  {name:'😳', id:'😳', value:10, isDefault:false},
  {name:'🙈', id:'🙈', value:25, isDefault:false},
  {name:'💍', id:'💍', value:100, isDefault:false}
];
const COMMAND_PREFIX = '!'; // appears before commands
const COMMANDS = [ // {regex, handler function, only handle cmd inside server chat?}
  {regex:/^help$/, handler:cmd_help, onlyInGuild:true}, // help docs
  {regex:/^karma( [\S]+)?$/, handler:cmd_karma, onlyInGuild:true} // check karma
];
const URL_REGEX = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig; // used to recognize urls

// --- --- --- INITS --- --- ---

const pgClient = new PGClient({ // init postgresql client
  connectionString: process.env.DATABASE_URL,
});
pgClient.connect(); // connect to db

const client = new Discord.Client(); // init discord api client
client.login(process.env.BOT_TOKEN); // login to discord api

setInterval(() => {
  http.get(KEEPALIVE_URL);
}, KEEPALIVE_INTERVAL); // make sure dyno doesn't fall asleep

// --- --- --- CMD FUNCS --- --- ---

function cmd_help(message) {
}

function cmd_karma(message) {
}

// --- --- --- HOOK FUNCS --- --- ---

function hk_ready() {
  console.log("READY");
  client.user.setPresence(PRESENCE); // set bot presence
  client.channels.forEach((channel) => { if (channel.type == 'text') channel.fetchMessages(); }); // listen to old messages
}

function hk_message(message) {
  if (message.author.id == client.user.id) return; // ignore own messages
  if (message.system) return; // ignore message sent by discord
  
  if (message.content.startsWith(COMMAND_PREFIX)) // we may be dealing with a command
  {
    COMMANDS.forEach((COMMAND) => {
      if (message.content.substring(COMMAND_PREFIX.length).match(COMMAND.regex) != null) { // we have a match
        if (COMMAND.onlyInGuilds && message.guild == null) return; // this command is only handled in server chat
        COMMAND.handler(message); // call the commands' handler function
      }
    });
  }
  
  if (message.embeds.length > 0 || message.attachments.size > 0 || message.content.match(URL_REGEX) != null)
  { // this classifies as a meme! (has embed OR has attachment OR has url)
    VOTES.forEach((VOTE) => { // react with default votes
      if (VOTE.isDefault) message.react(VOTE.id);
    });
  }
}

function hk_messageDelete(message) {
}

function hk_messageReaction(messageReaction, user, add) {
  if (user.id == client.user.id) return; // ignore reactions from cummy
  //if (user.id == messageReaction.message.author.id) return; // ignore reactions from message author
  if (messageReaction.message.channel.type == 'dm') return; // ignore reactions in dms
  
  VOTES.forEach((VOTE) => { // check if reaction is a vote
    if (VOTE.name == messageReaction.emoji.name) { // we have a match
      if (add)
        console.log('karma + ' + VOTE.value);
      else
        console.log('karma - ' + VOTE.value);
    }
  });
}

function hk_disconnect(event) {
  client.connect();
}

function hk_raw(packet) { // to make sure we don't miss events which wouldn't be fired usually
  // see https://github.com/AnIdiotsGuide/discordjs-bot-guide/blob/master/coding-guides/raw-events.md
  if (!['MESSAGE_DELETE', 'MESSAGE_REACTION_ADD', 'MESSAGE_REACTION_REMOVE'].includes(packet.t)) return;
  console.log(packet);
  const channel = client.channels.get(packet.d.channel_id);
  channel.fetchMessage(packet.t === 'MESSAGE_DELETE' ? packet.d.id : packet.d.message_id).then(message => {
    if (packet.t === 'MESSAGE_DELETE') {
      hk_messageDelete(message);
    }
    else {
      const emoji = packet.d.emoji.id ? `${packet.d.emoji.name}:${packet.d.emoji.id}` : packet.d.emoji.name;
      const reaction = message.reactions.get(emoji);
      if (reaction) reaction.users.set(packet.d.user_id, client.users.get(packet.d.user_id));
      hk_messageReaction(reaction, client.users.get(packet.d.user_id), packet.t === 'MESSAGE_REACTION_ADD');
    }
  });
}

// --- --- --- HOOKS --- --- ---

client.on('ready', () => hk_ready());
client.on('disconnect', (event) => hk_disconnect(event));
client.on('message', (message) => hk_message(message));
client.on('raw', (packet) => hk_raw(packet));
