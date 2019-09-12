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

const HELP_URL = "https://github.com/bmdyy/cummy2/blob/master/README.md";
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
  {regex:/^help$/, handler:cmd_help, onlyInGuild:false}, // help docs
  {regex:/^karma( [\S]+)?$/, handler:cmd_karma, onlyInGuild:false}, // check karma
  {regex:/^sendkarma [\S]+ [1-9]+[0-9]*$/, handler:cmd_sendkarma, onlyInGuild:false} // send karma to another user (by username)
];
const URL_REGEX = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig; // used to recognize urls
const USERSTRING_REGEX = /^[\S]{2,32}#[0-9]{4}$/; // used to recognize username#discriminator
const GUILD_ID = '621071935329140778';

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

// --- --- --- HELPER FUNCS --- --- ---

function sendKarma(sender, reciever, amount) {
  if (sender == reciever) return; 
  if (amount <= 0) return;
  pgClient.query('select * from karma where uid='+sender.id+';').then((res) => {
    if (res.rows[0].karma < amount) return;
    pgClient.query('update karma set karma=karma+1 where uid='+reciever.id+';update karma set karma=karma-1 where uid='+sender.id+';');
  });
}

function findUser(string) { // searches for user by username#discrim and returns User object (or null)
  var userObj = null;
  if (string.match(USERSTRING_REGEX) == null) return;
  var args = string.split('#');
  userObj = client.guilds.find(GUILD_ID).members.find((member) => {
    return member.user.username == args[0] && member.user.discriminator == args[1];
  });
  return userObj;
}

// --- --- --- CMD FUNCS --- --- ---

function cmd_help(message) {
  message.channel.send('<' + HELP_URL + '>'); // <> to avoid annoying embed
}

function cmd_karma(message) {
  var target = message.author;
  var args = message.content.split(' ');
  if (args.length > 1) target = findUser(args[1]); // specified user to check
  pgClient.query('select * from karma where uid='+target.id+';').then((res) => {
    message.channel.send(target.username + '#' + target.disciminator + ' has ' + res.rows[0].karma + ' karma.');
  });
}

function cmd_sendkarma(message) {
  var args = message.content.split(' ');
  var reciever_userObj = findUser(args[1].toLowerCase());
  var amount = parseInt(args[2]);
  if (reciever_userObj != null) sendKarma(message.author, reciever_userObj, amount);
}

// --- --- --- HOOK FUNCS --- --- ---

function hk_ready() {
  console.log("READY");
  client.user.setPresence(PRESENCE); // set bot presence
  client.channels.forEach((chan) => {
    if (chan.type == 'text') chan.fetchMessages();
  }); // cache old messages
}

function hk_message(message) {
  if (message.author.id == client.user.id) return; // ignore own messages
  if (message.system) return; // ignore messages sent by discord
  
  if (message.content.startsWith(COMMAND_PREFIX)) { // we may be dealing with a command
    COMMANDS.forEach((COMMAND) => {
      if (message.content.substring(COMMAND_PREFIX.length).match(COMMAND.regex) != null) { // we have a match
        if (COMMAND.onlyInGuilds && message.guild == null) return; // this command is only handled in server chat
        COMMAND.handler(message); // call the commands' handler function
      }
    });
  }
  
  if (message.embeds.length > 0 || message.attachments.size > 0 || message.content.match(URL_REGEX) != null) {
    // this classifies as a meme! (has embed OR has attachment OR has url)
    VOTES.forEach((VOTE) => { // react with default votes
      if (VOTE.isDefault) message.react(VOTE.id);
    });
  }
}

function hk_messageReaction(messageReaction, user, add) {
  if (user.id == client.user.id) return; // ignore reactions from cummy
  if (user.id == messageReaction.message.author.id) return; // ignore reactions from message author
  if (messageReaction.message.channel.type == 'dm') return; // ignore reactions in dms
  
  VOTES.forEach((VOTE) => { // check if reaction is a vote
    if (VOTE.name == messageReaction.emoji.name) { // we have a match!
      if (VOTE.value > 0) { // upvote logic
        if (add) sendKarma(user, messageReaction.message.author, VOTE.value);
        else sendKarma(messageReaction.message.author, user, VOTE.value);
      }
      else { // downvote logic
        
      }
    }
  });
}

function hk_disconnect(event) {
  client.connect();
}

function hk_raw(packet) {  // see https://github.com/AnIdiotsGuide/discordjs-bot-guide/blob/master/coding-guides/raw-events.md
  if (!['MESSAGE_REACTION_ADD', 'MESSAGE_REACTION_REMOVE'].includes(packet.t)) return;
  const channel = client.channels.get(packet.d.channel_id);
  channel.fetchMessage(packet.d.message_id).then(message => {
    const emoji = packet.d.emoji.id ? `${packet.d.emoji.name}:${packet.d.emoji.id}` : packet.d.emoji.name;
    const reaction = message.reactions.get(emoji);
    if (reaction) reaction.users.set(packet.d.user_id, client.users.get(packet.d.user_id));
    hk_messageReaction(reaction, client.users.get(packet.d.user_id), packet.t === 'MESSAGE_REACTION_ADD');
  });
}

// --- --- --- HOOKS --- --- ---

client.on('ready', () => hk_ready()); // when the bot is connected and ready to work
client.on('disconnect', (event) => hk_disconnect(event)); // reconnect when disconnected for whatever reason
client.on('message', (message) => hk_message(message)); 
/* we can't handle message deletes, because the reaction users are not
   listed (at least not on uncached messages, which could lead to an exploit where people 
   react negatively to their own (old) messages, delete them and gain free karma, at the same time
   creating new karma in a closed system out of nowhere. :( */
client.on('raw', (packet) => hk_raw(packet)); // to make sure we handle reactions on uncached messages
