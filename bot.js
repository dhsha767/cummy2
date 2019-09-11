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
  {id:'👎', value:-1, default:true},
  {id:'👍', value:1, default:true},
  {id:'🔥', value:5, default:false},
  {id:'😳', value:10, default:false},
  {id:'🙈', value:25, default:false},
  {id:'💍', value:100, default:false}
];
const COMMAND_PREFIX = '!'; // appears before commands
const COMMANDS = [ // {regex, handler function}
  {regex:/^help$/, handler:cmd_help}, // help docs
  {regex:/^karma( [\S]+)?$/, handler:cmd_karma} // check karma
];

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
  console.log('handle_help: ' + message);
}

function cmd_karma(message) {
  console.log('handle_karma: ' + message);
}

// --- --- --- HOOK FUNCS --- --- ---

function hk_ready() {
  console.log("READY");
  client.user.setPresence(PRESENCE);
}

function hk_message(message) {
  console.log("MESSAGE");
  if (message.author.bot) return; // sent by bot
  if (message.guild == null) return; // sent in dms
  if (message.content.startsWith(COMMAND_PREFIX)) // we may be dealing with a command
  {
    COMMANDS.forEach((COMMAND) => {
      if (message.content.substring(COMMAND_PREFIX.length).match(COMMAND.regex) != null) { // we have a match
       COMMAND.handler(message); 
      }
    });
  }
}

function hk_messageDelete(message) {
  console.log("MESSAGEDELETE");
}

function hk_messageReactionAdd(messageReaction, user) {
  console.log("MESSAGEREACTIONADD");
}

function hk_messageReactionRemove(messageReaction, user) {
  console.log("MESSAGEREACTIONREMOVE");
}

function hk_disconnect(event) {
  console.log("DISCONNECT");
  client.connect();
}

// --- --- --- HOOKS --- --- ---

client.on('ready', () => hk_ready());
client.on('message', (message) => hk_message(message));
client.on('messageDelete', (message) => hk_messageDelete(message));
client.on('messageReactionAdd', (messageReaction, user) => hk_messageReactionAdd(messageReaction, user));
client.on('messageReactionRemove', (messageReaction, user) => hk_messageReactionRemove(messageReaction, user));
client.on('disconnect', (event) => hk_disconnect(event));
