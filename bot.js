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
const VOTES = [ // {emoji id, value, reacted by default}
  {id:'👎', value:-1, isDefault:true},
  {id:'👍', value:1, isDefault:true},
  {id:'🔥', value:5, isDefault:true},
  {id:'😳', value:10, isDefault:true},
  {id:'🙈', value:25, isDefault:false},
  {id:'💍', value:100, isDefault:false}
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

function hk_messageReactionAdd(messageReaction, user) {
}

function hk_messageReactionRemove(messageReaction, user) {
}

function hk_disconnect(event) {
  client.connect();
}

// --- --- --- HOOKS --- --- ---

client.on('ready', () => hk_ready());
client.on('message', (message) => hk_message(message));
client.on('messageDelete', (message) => hk_messageDelete(message));
client.on('messageReactionAdd', (messageReaction, user) => hk_messageReactionAdd(messageReaction, user));
client.on('messageReactionRemove', (messageReaction, user) => hk_messageReactionRemove(messageReaction, user));
client.on('disconnect', (event) => hk_disconnect(event));
