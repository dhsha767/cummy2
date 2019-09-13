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
  {name:'🔥', id:'🔥', value:10, isDefault:false},
  {name:'😳', id:'😳', value:25, isDefault:false},
  {name:'🙈', id:'🙈', value:50, isDefault:false},
  {name:'💍', id:'💍', value:100, isDefault:false}
];
const COMMAND_PREFIX = '!'; // appears before commands
const COMMANDS = [ // {regex, handler function, only handle cmd inside server chat?, only owner can issue command}
  {regex:/^help$/, handler:cmd_help, onlyInGuild:false, onlyByOwner:false}, // help docs
  {regex:/^karma( [\S]+)?$/, handler:cmd_karma, onlyInGuild:false, onlyByOwner:false}, // check karma
  {regex:/^sendkarma [\S]+ [1-9]+[0-9]*$/, handler:cmd_sendkarma, onlyInGuild:false, onlyByOwner:false}, // send karma to another user (by username)
  {regex:/^compare [\S]{2,32}#[0-9]{4}( [\S]{2,32}#[0-9]{4})?$/, handler:cmd_compare, onlyInGuild:false, onlyByOwner:false}, // compares two users karma
  {regex:/^sql .+;$/, handler:cmd_sql, onlyInGuild:false, onlyByOwner:true} // run sql commands from discord
];
const URL_REGEX = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig; // used to recognize urls
const USERSTRING_REGEX = /^[\S]{2,32}#[0-9]{4}$/; // used to recognize username#discriminator
const GUILD_ID = '621071935329140778';
const LEADERBOARD_CHANNEL_ID = '621087939820257300';
const LEADERBOARD_MESSAGE_ID = '621604987004518419';
const LEADERBOARD_MAX_COUNT = 10;
const LEADERBOARD_MAX_TIME_SINCE_LAST_MEME = 7 * 24 * 60 * 60 * 1000; // 7 days
const LEADERBOARD_MIN_MEMES = 5;
const TRANSACTIONS_CHANNEL_ID = '621656560648847379';
const TRANSACTIONS_MESSAGE_ID = '621657793203666945';
const TRANSACTIONS_MAX_COUNT = 10; // how many past transactions to log
const OWNER_ID = '364289961567977472'; // bmdyy#0068

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

function getTimeStamp() {
  return new Date().toUTCString();
}

function sendKarma(sender, reciever, amount, fromMeme) { // if fromMeme, update karmafrommemes as well
  // fromMeme = undefined => call didnt come from a meme
  // fromMeme = 1 => reciever gets +1 kfm ( author )
  // fromMeme = 2 => sender gets -1 kfm ( author )
  if (sender == reciever) return; 
  if (amount <= 0) return;
  getInfo(sender).then((info) => {
    if (info.rows[0].karma < amount) return;
    pgClient.query('update karma set karma=karma+'+amount+' where uid='+reciever.id+';\
    update karma set karma=karma-'+amount+' where uid='+sender.id+';\
    '+(fromMeme===undefined?'':('update karma set karmafrommemes=karmafrommemes'+(fromMeme==1?('+'+amount):('-'+amount)) + ';')))
    .then(res => {
      updateLeaderboard();
      updateTransactions(sender, reciever, amount, fromMeme);
    });
  });
}
function updateDownvotes(reciever, amount) {
  if (reciever == null) return;
  pgClient.query('update karma set downvotes=downvotes'+(amount>=0?'+':'-')+Math.abs(amount)+' where uid='+reciever.id+';');
  updateLeaderboard();
}

function updateMemeCount(author) { // update #memes and lastmeme fields
  pgClient.query('update karma set memes=memes+1,lastmeme='+new Date().getTime()+'where uid='+author.id+';');
}

function findUser(string) { // searches for user by username#discrim and returns User object (or null)
  if (string.match(USERSTRING_REGEX) == null) return;
  var args = string.split('#');
  var userObj = client.guilds.get(GUILD_ID).members.find((val) => {
    return val['user'].username.toLowerCase() == args[0].toLowerCase() && val['user'].discriminator == args[1];
  });
  return userObj==null ? null : userObj.user;
}

function getUserFromUid(uid) {
  return client.guilds.get(GUILD_ID).members.get(uid).user; 
}

function updateLeaderboard() {
  var leaderboard_msg = client.channels.get(LEADERBOARD_CHANNEL_ID).messages.get(LEADERBOARD_MESSAGE_ID);
  var embed = new Discord.RichEmbed()
    .setColor(0xFFFF00)
    .setTitle('TOP ' + LEADERBOARD_MAX_COUNT + ' DANK-MEMERS')
    .setDescription(HELP_URL); 
  pgClient.query('select * from karma where lastmeme>=' + (new Date().getTime() - LEADERBOARD_MAX_TIME_SINCE_LAST_MEME) + ' and memes>=' + LEADERBOARD_MIN_MEMES + ' order by karmafrommemes/memes-downvotes/10 desc limit '+LEADERBOARD_MAX_COUNT+';').then(res => {
    for (var i = 0; i < LEADERBOARD_MAX_COUNT; i+=1) {
      var v = (i+1) + '. ';
      var f = '';
      if (i < res.rows.length) {
        var u = getUserFromUid(res.rows[i].uid);
        v += u.username + '#' + u.discriminator;
        f = '**' + (Math.round(res.rows[i].karmafrommemes / res.rows[i].memes * 100)/100) + '** avg. kpm, **' + res.rows[i].karma + '** karma, **' + res.rows[i].downvotes + '** downvotes';
      } else {
        v += '-'; 
        f = '-';
      }
      embed.addField(v, f, false); 
    }
    leaderboard_msg.edit('Last updated @ ' + getTimeStamp(), embed);
  });
}

function updateTransactions(sender, reciever, amount, fromMeme) {
  var transactions_msg = client.channels.get(TRANSACTIONS_CHANNEL_ID).messages.get(TRANSACTIONS_MESSAGE_ID);
  var old_fields = transactions_msg.embeds[0].fields;
  var embed = new Discord.RichEmbed()
    .setColor(0xFFFF00)
    .setTitle('PAST ' + TRANSACTIONS_MAX_COUNT + ' TRANSACTIONS')
    .setDescription(HELP_URL);
  while (old_fields.length > TRANSACTIONS_MAX_COUNT - 1) { old_fields.pop(); }
  embed.addField(sender.username + '#' + sender.discriminator + ' -> ' + reciever.username + '#' + reciever.discriminator + ' _(' + (fromMeme===undefined?'Manual':(fromMeme==1?'Upvote removed':'Upvote added')) + ')_', '**' + amount + '** karma ['+getTimeStamp()+']');
  old_fields.forEach(field => {
    embed.addField(field.name, field.value, field.inline);
  });
  transactions_msg.edit('Last updated @ ' + getTimeStamp(), embed);
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
      var kpm = info.rows[0].memes>0 ? (Math.round(info.rows[0].karmafrommemes / info.rows[0].memes * 100)/100) : 0;
      var lm = Math.round((new Date().getTime() - info.rows[0].lastmeme)/1000/60/60 * 100)/100; // hours
      var embed = new Discord.RichEmbed()
        .setColor(0xFFFF00)
        .setTitle(target.username + '#' + target.discriminator)
        .addField(info.rows[0].karma + ' karma', info.rows[0].downvotes + ' downvotes')
        .addField(kpm + ' kpm', info.rows[0].memes + ' memes')
        .addField(info.rows[0].karmafrommemes + ' kfm', 'last meme: ' + lm + ' hrs ago')
        .setFooter('kpm = karma per meme, kfm = karma from memes');
      message.channel.send(embed);
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
  if (user1 != null && user2 != null) {
    getInfo(user1).then((user1_info) => {
      getInfo(user2).then((user2_info) => {
        if (user1_info != null && user2_info != null) {
          var u1_k = user1_info.rows[0].karma;
          var u2_k = user2_info.rows[0].karma;
          var u1_d = user1_info.rows[0].downvotes;
          var u2_d = user2_info.rows[0].downvotes;
          var u1_m = user1_info.rows[0].memes;
          var u2_m = user2_info.rows[0].memes;
          var u1_f = user1_info.rows[0].karmafrommemes;
          var u2_f = user2_info.rows[0].karmafrommemes;
          var u1_a = u1_m>0 ? (Math.round(100 * u1_f / u1_m)/100) : 0;
          var u2_a = u2_m>0 ? (Math.round(100 * u2_f / u2_m)/100) : 0;
          var k_comp = u1_k>u2_k?0:(u1_k<u2_k?1:2); // u1 / u2 / eq
          var d_comp = u1_d<u2_d?0:(u1_d>u2_d?1:2); // u1 / u2 / eq
          var a_comp = u1_a>u2_a?0:(u1_a<u2_a?1:2); // u1 / u2 / eq
          var u1_s = (k_comp!=1?1:0) + (d_comp!=1?1:0) + (a_comp!=1?1:0);
          var u2_s = (k_comp>0?1:0) + (d_comp>0?1:0) + (a_comp>0?1:0);
          var w = u1_s>u2_s?user1:(u1_s<u2_s?user2:null);
          var embed = new Discord.RichEmbed()
            .setColor(0xFFFF00)
            .addField(user1.username + '#' + user1.discriminator, (k_comp!=1?'('+u1_k+')':u1_k) + ' karma', true)
            .addField(user2.username + '#' + user2.discriminator, (k_comp>0?'('+u2_k+')':u2_k) + ' karma', true)
            .addBlankField(true)
            .addField((d_comp!=1?'('+u1_d+')':u1_d) + ' downvotes', (a_comp!=1?'('+u1_a+')':u1_a) + ' avg. kpm', true)
            .addField((d_comp>0?'('+u2_d+')':u2_d) + ' downvotes', (a_comp>0?'('+u2_a+')':u2_a) + ' avg. kpm', true)
            .addBlankField(true)
            .addField(u1_m + ' memes', u1_f + ' kfm', true)
            .addField(u2_m + ' memes', u2_f + ' kfm', true)
            .addBlankField(true)
            .addField('Overal score is **' + u1_s + '-'+ u2_s + '** in favor of **' + (w!=null?w.username+'#'+w.discriminator:'nobody') + '**', '-')
            .setFooter('kpm = karma per meme, kfm = karma from memes');
          message.channel.send(embed);
        }
        else {
          message.channel.send('_Couldn\'t find one or both of the specified users._');
        }
      });
    });
  }
}

function cmd_sql(message) {
  var q = message.content.split(' ');
  q.shift();
  q = q.join(' ');
  pgClient.query(q).then((res) => {
    var msg = '```json\n';
    if (res.command == 'SELECT') {
      res.rows.forEach(row => {
        msg += JSON.stringify(row) + '\n';
      }); 
    }
    msg += res.command + ' : ' + res.rowCount + ' rows affected.```';
    message.channel.send(msg);
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
        if (COMMAND.onlyByOwner && message.author.id != OWNER_ID) return; // this command is only avaliable to owner
        COMMAND.handler(message); // call the commands' handler function
      }
    });
  }
  
  if (message.embeds.length > 0 || message.attachments.size > 0 || message.content.match(URL_REGEX) != null) {
    // this classifies as a meme! (has embed OR has attachment OR has url)
    VOTES.forEach((VOTE) => { // react with default votes
      if (VOTE.isDefault) message.react(VOTE.id);
    });
    updateMemeCount(message.author);
  }
}

function hk_messageReaction(message, emoji, user, add) {
  if (user.id == client.user.id) return; // ignore reactions from cummy
  if (user.id == message.author.id) return; // ignore reactions from message author
  if (message.channel.type == 'dm') return; // ignore reactions in dms
  
  VOTES.forEach((VOTE) => { // check if reaction is a vote
    if (VOTE.name == emoji.name) { // we have a match!
      if (VOTE.value > 0) // upvote logic
        add ? sendKarma(user, message.author, VOTE.value, 2) : sendKarma(message.author, user, VOTE.value, 1);
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
client.on('raw', (packet) => hk_raw(packet)); // to make sure we handle reactions on uncached messages
/* might have to look more into this.. maybe it is possible. BUT for now
   we can't handle message deletes, because the reaction users are not
   listed (at least not on uncached messages, which could lead to an exploit where people 
   react negatively to their own (old) messages, delete them and gain free karma, at the same time
   creating new karma in a closed system out of nowhere. :( */
