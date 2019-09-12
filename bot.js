/*
  @title        Cummy2
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
const PRESENCE = {status:'idle',game:{type:'WATCHING',name:'pornhub.com/gay'}}; // type PresenceData
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
  {regex:/^sendkarma [\S]+ [1-9]+[0-9]*$/, handler:cmd_sendkarma, onlyInGuild:false}, // send karma to another user (by username)
  {regex:/^compare [\S]{2,32}#[0-9]{4}( [\S]{2,32}#[0-9]{4})?$/, handler:cmd_compare, onlyInGuild:false} // compares two users karma
];
const URL_REGEX = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig; // used to recognize urls
const USERSTRING_REGEX = /^[\S]{2,32}#[0-9]{4}$/; // used to recognize username#discriminator
const GUILD_ID = '621071935329140778';
const LEADERBOARD_CHANNEL_ID = '621087939820257300';
const LEADERBOARD_MESSAGE_ID = '621604987004518419';

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

function getInfo(user) {
  return pgClient.query('select * from karma where uid='+user.id+';');
}

function sendKarma(sender, reciever, amount) {
  if (sender == reciever) return; 
  if (amount <= 0) return;
  getInfo(sender).then((info) => {
    if (info.rows[0].karma < amount) return;
    pgClient.query('update karma set karma=karma+'+amount+' where uid='+reciever.id+';update karma set karma=karma-'+amount+' where uid='+sender.id+';');
    updateLeaderboard();
  });
}
function updateDownvotes(reciever, amount) {
  if (reciever == null) return;
  pgClient.query('update karma set downvotes=downvotes'+(amount>=0?'+':'-')+Math.abs(amount)+' where uid='+reciever.id+';');
  updateLeaderboard();
}

function findUser(string) { // searches for user by username#discrim and returns User object (or null)
  if (string.match(USERSTRING_REGEX) == null) return;
  var args = string.split('#');
  var userObj = client.guilds.get(GUILD_ID).members.find((val) => {
    return val['user'].username.toLowerCase() == args[0].toLowerCase() && val['user'].discriminator == args[1];
  });
  return userObj.user;
}

function updateLeaderboard() {
  var leaderboard_msg = client.channels.get(LEADERBOARD_CHANNEL_ID).messages.get(LEADERBOARD_MESSAGE_ID);
  leaderboard_msg.edit('r'+Math.random());
}

// --- --- --- CMD FUNCS --- --- ---

function cmd_help(message) {
  message.channel.send('_<' + HELP_URL + '>_'); // <> to avoid annoying embed
}

function cmd_karma(message) {
  var target = message.author;
  var args = message.content.split(' ');
  if (args.length > 1) target = findUser(args[1]); // specified user to check
  if (target == null) { // didnt find
    message.channel.send('_Couldn\'t find ' + args[1] + '._');
  } else {
    getInfo(target).then((info) => {
      message.channel.send('***' + target.username + '#' + target.discriminator + '*** _has_ ***' + info.rows[0].karma + '*** _karma and_ ***' + info.rows[0].downvotes + '*** _downvotes._');
    });
  }
}

function cmd_sendkarma(message) {
  var args = message.content.split(' ');
  var reciever_userObj = findUser(args[1]);
  if (reciever_userObj == null) { // didnt find
    message.channel.send('_Couldn\'t find ' + args[1] + '._');
    return;
  } else {
    var amount = parseInt(args[2]);
    sendKarma(message.author, reciever_userObj, amount);
    message.channel.send('***' + message.author.username + '#' + message.author.discriminator + '*** _sent_ ***' + amount + '*** _karma to_ ***' + reciever_userObj.username + '#' + reciever_userObj.discriminator + '***_._');
  }
}

function cmd_compare(message) {
  var args = message.content.split(' ');
  var user1 = findUser(args[1]);
  var user2 = args.length > 2 ? findUser(args[2]) : message.author;
  getInfo(user1).then((user1_info) => {
    getInfo(user2).then((user2_info) => {
      if (user1 != null && user2 != null && user1_info != null && user2_info != null) {
        var u1_k = user1_info.rows[0].karma;
        var u2_k = user2_info.rows[0].karma;
        var u1_d = user1_info.rows[0].downvotes;
        var u2_d = user2_info.rows[0].downvotes;
        var k_comp = u1_k>u2_k?0:(u1_k<u2_k?1:2); // u1 / u2 / eq
        var d_comp = u1_d<u2_d?0:(u1_d>u2_d?1:2); // u1 / u2 / eq
        var embed = new Discord.RichEmbed()
          .setColor('#ffff00')
          .addField(user1.username + '#' + user1.discriminator, (k_comp!=1?'('+u1_k+')':u1_k) + ' karma', true)
          .addField(user2.username + '#' + user2.discriminator, (k_comp>0?'('+u2_k+')':u2_k) + ' karma', true)
          .addBlankField(true)
          .addField((d_comp!=1?'('+u2_d+')':u2_d) + ' downvotes', ' avg. kpm', true)
          .addField((d_comp>0?'('+u2_d+')':u2_d) + ' downvotes', 'avg. kpm', true)
          .setFooter('_kpm = karma per. meme_');
        message.channel.send(embed);
      }
      else {
        message.channel.send('_Couldn\'t find one or both of the specified users._');
      }
    });
  });
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

function hk_messageReaction(message, emoji, user, add) {
  if (user.id == client.user.id) return; // ignore reactions from cummy
  if (user.id == message.author.id) return; // ignore reactions from message author
  if (message.channel.type == 'dm') return; // ignore reactions in dms
  
  VOTES.forEach((VOTE) => { // check if reaction is a vote
    if (VOTE.name == emoji.name) { // we have a match!
      if (VOTE.value > 0) // upvote logic
        add ? sendKarma(user, message.author, VOTE.value) : sendKarma(message.author, user, VOTE.value);
      else // downvote logic
        updateDownvotes(message.author, add?1:-1);
    }
  });
}

function hk_disconnect(event) {
  client.connect();
}

function hk_raw(packet) {  // see https://github.com/AnIdiotsGuide/discordjs-bot-guide/blob/master/coding-guides/raw-events.md
  if (!['MESSAGE_REACTION_ADD', 'MESSAGE_REACTION_REMOVE'].includes(packet.t)) return;
  const channel = client.channels.get(packet.d.channel_id);
  channel.fetchMessage(packet.d.message_id).then((message) => {
    hk_messageReaction(message, packet.d.emoji, client.users.get(packet.d.user_id), packet.t === 'MESSAGE_REACTION_ADD');
  });
}

// --- --- --- HOOKS --- --- ---

client.on('ready', () => hk_ready()); // when the bot is connected and ready to work
client.on('disconnect', (event) => hk_disconnect(event)); // reconnect when disconnected for whatever reason
client.on('message', (message) => hk_message(message)); 
/* might have to look more into this.. maybe it is possible. BUT for now
   we can't handle message deletes, because the reaction users are not
   listed (at least not on uncached messages, which could lead to an exploit where people 
   react negatively to their own (old) messages, delete them and gain free karma, at the same time
   creating new karma in a closed system out of nowhere. :( */
client.on('raw', (packet) => hk_raw(packet)); // to make sure we handle reactions on uncached messages
