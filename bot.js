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
const PRESENCE = {status:'idle',game:{type:'WATCHING',name:'http://www.pornhub.com/gay'}}; // type PresenceData
const VOTES = [ // {emoji name, value, reacted by default}
  {name:'downvote', id:'623549772426379296', value:-1, isDefault:true},
  {name:'upvote_1', id:'623549773517029377', value:1, isDefault:true},
  {name:'upvote_10', id:'623549774615805952', value:10, isDefault:false},
  {name:'upvote_25', id:'623549773911293972', value:25, isDefault:false},
  {name:'upvote_50', id:'623549775576432651', value:50, isDefault:false},
  {name:'upvote_100', id:'623549774913863690', value:100, isDefault:false}
];
const COMMAND_PREFIX = '!'; // appears before commands
const COMMANDS = [ // {regex, handler function, only handle cmd inside server chat?, only owner can issue command}
  {regex:/^help$/, handler:cmd_help, onlyInGuild:false, onlyByOwner:false}, // help docs
  {regex:/^karma( [\S]+)?$/, handler:cmd_karma, onlyInGuild:false, onlyByOwner:false}, // check karma
  {regex:/^sendkarma [\S]+ [1-9]+[0-9]*$/, handler:cmd_sendkarma, onlyInGuild:false, onlyByOwner:false}, // send karma to another user (by username)
  {regex:/^compare [\S]{2,32}#[0-9]{4}( [\S]{2,32}#[0-9]{4})?$/, handler:cmd_compare, onlyInGuild:false, onlyByOwner:false}, // compares two users karma
  {regex:/^sql .+;$/, handler:cmd_sql, onlyInGuild:false, onlyByOwner:true}, // run sql commands from discord
  {regex:/^js .+;$/, handler:cmd_js, onlyInGuild:false, onlyByOwner:true} // run js commands from discord
];
const ROLES = [ // {id, lowBound, highBound}
  {id:'623466356456816640', lowBound:0, upBound:249},
  {id:'623466582190063617', lowBound:250, upBound:499},
  {id:'623466634866327572', lowBound:500, upBound:749},
  {id:'623466690260500491', lowBound:750, upBound:999},
  {id:'623466734686437386', lowBound:1000, upBound:1249},
  {id:'623466783575244801', lowBound:1250, upBound:1499},
  {id:'623466838982131713', lowBound:1500, upBound:1749},
  {id:'623466891058348042', lowBound:1750, upBound:1999},
  {id:'623466939414741002', lowBound:2000, upBound:999999}
  
];
const URL_REGEX = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig; // used to recognize urls
const USERSTRING_REGEX = /^[\S]{2,32}#[0-9]{4}$/; // used to recognize username#discriminator
const GUILD_ID = '532907700326105108';
const LEADERBOARD_CHANNEL_ID = '623466100637696001';
const LEADERBOARD_MESSAGE_ID = '623471149044596743';
const LEADERBOARD_MAX_COUNT = 10;
const LEADERBOARD_MAX_TIME_SINCE_LAST_MEME = 7 * 24 * 60 * 60 * 1000; // 7 days
const LEADERBOARD_MIN_MEMES = 5;
const AAKPM_DOWNVOTE_COEFF = 10; // A = kfm / memes - d / AAKPM_DOWNVOTE_COEFF
const TRANSACTIONS_CHANNEL_ID = '623465681031135242';
const TRANSACTIONS_MESSAGE_ID = '623471194326302731';
const TRANSACTIONS_MAX_COUNT = 10; // how many past transactions to log
const MOTWD_CHANNEL_ID = '623465731857711125';
const MOTWD_RESET_TIME = [1, 0, 0]; // day, hours, minutes [0-sunday -> 6-saturday]
const OWNER_ID = '364289961567977472'; // bmdyy#0068
const STARTING_KARMA = 1000; // how much to start everyone with
var INITIALIZED_USERS = []; // keep track of users we know are registered, to avoid unecessary sql queries (until next restart of course)

// --- --- --- INITS --- --- ---

const pgClient = new PGClient({ // init postgresql client
  connectionString: process.env.DATABASE_URL,
});
pgClient.connect(); // connect to db

const client = new Discord.Client(); // init discord api client
client.login(process.env.BOT_TOKEN); // login to discord api

setInterval(() => {
  http.get(KEEPALIVE_URL);
  var d = new Date();
  if (d.getHours() == MOTWD_RESET_TIME[1] && (d.getMinutes() >= MOTWD_RESET_TIME[2] && d.getMinutes() < MOTWD_RESET_TIME[2] + KEEPALIVE_INTERVAL/(60* 1000))) {
    // issue MotD
    issueMemeOfThe('Day');
    if (d.getDay() == MOTWD_RESET_TIME[0]) {
      // issue MotW and truncate table 
      issueMemeOfThe('Week');
      resetDownvotes();
      resetMemeTable();
    }
  }
}, KEEPALIVE_INTERVAL); // make sure dyno doesn't fall asleep ALSO issue motw/d + clear memes table when its time ALSO decay downvotes

// --- --- --- HELPER FUNCS --- --- ---

function initAll() { // for testing. call with !js initAll();
  client.guilds.get(GUILD_ID).members.forEach(member => {
    initUser(member.user);
  });
}

function initUser(user) {
  if (user.bot) return new Promise((resolve, reject) => { resolve(0); }); // ignore bots for now
  if (INITIALIZED_USERS.indexOf(user.id)>=0) {
    updateRole(client.guilds.get(GUILD_ID).members.get(user.id));
    return new Promise((resolve, reject) => { resolve(0); }); // ignore for now
  } else {
    INITIALIZED_USERS.push(user.id);
    return pgClient.query('insert into karma (uid, karma) values (' + user.id + ',' + STARTING_KARMA + ') on conflict do nothing;');
  }
}

function updateRole(guildmember) {
  if (guildmember.user.bot) return;
  getInfo(guildmember).then(info => {
    ROLES.forEach(role => {
      if (info.rows[0].karma >= role.lowBound && info.rows[0].karma <= role.upBound) {
        guildmember.addRole(role.id);
      } else {
        guildmember.removeRole(role.id); 
      }
    });
  });
}

function resetDownvotes() {
  pgClient.query('update karma set downvotes=0;');
}

function issueMemeOfThe(p) {
  pgClient.query('select * from memes '+(p=='Day'?(' where posttime>'+(new Date().getTime() - 1000*60*60*24)):'')+' order by upvotes desc;').then((res) => {
    if (res.rows.length == 0) {
      client.channels.get(MOTWD_CHANNEL_ID).send('Sadly, there is no Meme of the '+p+' this time, as nothing was posted.');
    } else {
      var m = res.rows[0];
      var l = 'https://discordapp.com/channels/'+GUILD_ID+'/'+m.channelid+'/'+m.messageid;
      client.channels.get(MOTWD_CHANNEL_ID).send('**Meme of the '+p+'** ['+m.upvotes+' upvotes] goes to <@'+m.author+'>, congratulations!\n_<' + l + '>_\n_Total memes posted this ' + p + ': ' + res.rows.length + '_ ['+getTimeStamp()+']\n---');
      var c = p=='Day'?'motd':'motw';
      pgClient.query('update karma set '+c+'='+c+'+1 where uid='+m.author+';');
    }
  });
}

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
    if (info.rows[0].karma < amount) {
      return;
    } else {
      pgClient.query('update karma set karma=karma+'+amount+' where uid='+reciever.id+';\
      update karma set karma=karma-'+amount+' where uid='+sender.id+';\
      '+(fromMeme===undefined?'':('update karma set karmafrommemes=karmafrommemes'+(fromMeme==1?('-'+amount):('+'+amount)) + ' where uid='+(fromMeme==1?sender.id:reciever.id)+';')))
      .then(res => {
        updateLeaderboard();
        updateTransactions(sender, reciever, amount, fromMeme);
      });
    }
  });
}
function updateDownvotes(reciever, amount) {
  if (reciever == null) return;
  pgClient.query('update karma set downvotes=downvotes'+(amount>=0?'+':'-')+Math.abs(amount)+' where uid='+reciever.id+';');
  updateLeaderboard();
}

function addToMemeTable(message) {
  return pgClient.query('insert into memes (channelid, messageid, author, posttime) values ('+message.channel.id+','+message.id+','+message.author.id+','+message.createdTimestamp+') on conflict do nothing;');
}

function updateMemeTable(message, value, add) {
  addToMemeTable(message).then(ret => {
    pgClient.query('update memes set upvotes=upvotes'+(add?'+':'-')+value+' where messageid=' + message.id + ';');
  });
}

function resetMemeTable() {
  pgClient.query('truncate table memes;');
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
    .setDescription(HELP_URL)
    .setTitle('TOP ' + LEADERBOARD_MAX_COUNT + ' DANK-MEMERS')
    .setFooter('[xx.xx] is adjusted average karma per meme, MotD/W stand for Meme of the Day/Week respectively. Follow link to the README for more information.'); 
  pgClient.query('select * from karma where lastmeme>=' + (new Date().getTime() - LEADERBOARD_MAX_TIME_SINCE_LAST_MEME) + ' and memes>=' + LEADERBOARD_MIN_MEMES + ' order by (karmafrommemes/cast(memes as float)-downvotes/cast('+AAKPM_DOWNVOTE_COEFF+' as float)) desc limit '+LEADERBOARD_MAX_COUNT+';').then(res => {
    for (var i = 0; i < LEADERBOARD_MAX_COUNT; i+=1) {
      var v = (i+1) + '. ';
      var f = '';
      if (i < res.rows.length) {
        var u = getUserFromUid(res.rows[i].uid);
        var kpm = res.rows[i].karmafrommemes / res.rows[i].memes;
        var s = kpm - res.rows[i].downvotes/AAKPM_DOWNVOTE_COEFF;
        v += '__' + u.username + '#' + u.discriminator + '__ ['+ (Math.round(s * 100)/100) + ']';
        if (res.rows[i].motw>0) v+= ' `' + res.rows[i].motw + 'x MotW`';
        if (res.rows[i].motd>0) v+= ' `' + res.rows[i].motd + 'x MotD`';
        f = '**' + (Math.round(kpm * 100)/100) + '** avg. kpm, **' + res.rows[i].karma + '** karma, **' + res.rows[i].downvotes + '** downvotes';
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
    .setDescription(HELP_URL)
    .setFooter('See link to the README for further information.');
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
    initUser(target).then(init_res => {
      getInfo(target).then((info) => {
        var kpm = info.rows[0].memes>0 ? (Math.round(100 * info.rows[0].karmafrommemes / info.rows[0].memes - info.rows[0].downvotes/AAKPM_DOWNVOTE_COEFF )/100) : 0;
        var lm = info.rows[0].lastmeme==0 ? 'n/a' : Math.round((new Date().getTime() - info.rows[0].lastmeme)/1000/60/60 * 100)/100; // hours
        var embed = new Discord.RichEmbed()
          .setColor(0xFFFF00)
          .setTitle(target.username + '#' + target.discriminator)
          .addField(info.rows[0].karma + ' karma', info.rows[0].downvotes + ' downvotes')
          .addField(kpm + ' kpm', info.rows[0].memes + ' memes')
          .addField(info.rows[0].karmafrommemes + ' kfm', 'last meme: ' + lm + ' hrs ago')
          .addField(info.rows[0].motw + 'x MotW', info.rows[0].motd + 'x MotD')
          .setFooter('kpm = karma per meme, kfm = karma from memes, motw/d = meme of the week/day');
        message.channel.send(embed);
      });
    });
  }
}

function cmd_sendkarma(message) {
  var args = message.content.split(' ');
  var reciever_userObj = findUser(args[1]);
  initUser(message.author).then(init1_res => {
    initUser(reciever_userObj).then(init2_res => {
      if (reciever_userObj == null) { // didnt find
        message.channel.send('_Couldn\'t find ' + args[1] + '._');
        return;
      } else {
        var amount = parseInt(args[2]);
        sendKarma(message.author, reciever_userObj, amount);
        message.channel.send('***' + message.author.username + '#' + message.author.discriminator + '*** _sent_ ***' + amount + '*** _karma to_ ***' + reciever_userObj.username + '#' + reciever_userObj.discriminator + '***_._'); 
      }
    });
  });
}

function cmd_compare(message) {
  var args = message.content.split(' ');
  var user1 = findUser(args[1]);
  var user2 = args.length > 2 ? findUser(args[2]) : message.author;
  if (user1 != null && user2 != null) {
    initUser(user1).then(init1_res => {
      initUser(user2).then(init2_res => {
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
                var u1_w = user1_info.rows[0].motw;
                var u2_w = user2_info.rows[0].motw;
                var u1_t = user1_info.rows[0].motd;
                var u2_t = user2_info.rows[0].motd;
                var u1_a = u1_m>0 ? (Math.round(100 * (u1_f / u1_m - u1_d/AAKPM_DOWNVOTE_COEFF))/100) : 0;
                var u2_a = u2_m>0 ? (Math.round(100 * (u2_f / u2_m - u2_d/AAKPM_DOWNVOTE_COEFF))/100) : 0;
                var k_comp = u1_k>u2_k?0:(u1_k<u2_k?1:2); // u1 / u2 / eq
                var d_comp = u1_d<u2_d?0:(u1_d>u2_d?1:2); // u1 / u2 / eq
                var a_comp = u1_a>u2_a?0:(u1_a<u2_a?1:2); // u1 / u2 / eq
                var w_comp = u1_w>u2_w?0:(u1_w<u2_w?1:2); // u1 / u2 / eq
                var t_comp = u1_t>u2_t?0:(u1_t<u2_t?1:2); // u1 / u2 / eq
                var embed = new Discord.RichEmbed()
                  .setColor(0xFFFF00)
                  .setTitle('It\'s flexing time 😎')
                  .addField(user1.username + '#' + user1.discriminator, (k_comp!=1?'__'+u1_k+'__':u1_k) + ' karma', true)
                  .addField(user2.username + '#' + user2.discriminator, (k_comp>0?'__'+u2_k+'__':u2_k) + ' karma', true)
                  .addBlankField(true)
                  .addField((d_comp!=1?'__'+u1_d+'__':u1_d) + ' downvotes', (a_comp!=1?'__'+u1_a+'__':u1_a) + ' adj. avg. kpm', true)
                  .addField((d_comp>0?'__'+u2_d+'__':u2_d) + ' downvotes', (a_comp>0?'__'+u2_a+'__':u2_a) + ' adj. avg. kpm', true)
                  .addBlankField(true)
                  .addField(u1_m + ' memes', u1_f + ' kfm', true)
                  .addField(u2_m + ' memes', u2_f + ' kfm', true)
                  .addBlankField(true)
                  .addField((w_comp!=1?'__'+u1_w+'__':u1_w) + 'x motw', (t_comp!=1?'__'+u1_t+'__':u1_t) + 'x motd', true)
                  .addField((w_comp>0?'__'+u2_w+'__':u2_w) + 'x motw', (t_comp>0?'__'+u2_t+'__':u2_t) + 'x motd', true)
                  .addBlankField(true)
                  .setFooter('kpm = karma per meme, kfm = karma from memes, motw/d = meme of the week/day');
                message.channel.send(embed);
              }
            });
          });
      });
    });
  } else {
    message.channel.send('_Couldn\'t find one or both of the specified users._'); 
  }
}

function cmd_sql(message) {
  var q = message.content.split(' ');
  q.shift();
  q = q.join(' ');
  pgClient.query(q).then((res) => {
    INITIALIZED_USERS = []; // to avoid a specific bug that shouldn't appear in final release anyways.
    var msg = '```json\n';
    if (res.command == 'SELECT') {
      res.rows.forEach(row => {
        msg += JSON.stringify(row) + '\n';
      }); 
    }
    if (msg.length > 1950) msg = msg.substring(0, 1950) + '...\n';
    msg += res.command + ' : ' + res.rowCount + ' rows affected.```';
    message.channel.send(msg);
  });
}

function cmd_js(message) {
  var q = message.content.split(' ');
  q.shift();
  q = q.join(' ');
  var ret = '```json\n' + eval(q);
  if (ret.length > 1950) ret.substring(0, 1950);
  ret += '\n```';
  message.channel.send(ret);
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
  initUser(message.author).then(init_res => {
    if (message.author.id == client.user.id) return; // ignore own messages
    if (message.system) return; // ignore messages sent by discord
    if (message.channel.type == 'dm') return; // ignore dms

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
      addToMemeTable(message);
    }
  });
}

function hk_messageReaction(message, emoji, user, add) {
  initUser(message.author).then(init1_res => {
    initUser(user).then(init2_res => {
      if (user.id == client.user.id) return; // ignore reactions from cummy
      if (user.id == message.author.id) return; // ignore reactions from message author
      if (message.channel.type == 'dm') return; // ignore reactions in dms

      VOTES.forEach((VOTE) => { // check if reaction is a vote
        if (VOTE.name == emoji.name) { // we have a match!
          if (VOTE.value > 0) { // upvote logic
            add ? sendKarma(user, message.author, VOTE.value, 2) : sendKarma(message.author, user, VOTE.value, 1);
            updateMemeTable(message, VOTE.value, add);
          } else { // downvote logic
            updateDownvotes(message.author, add?1:-1);
          }
        }
      });
    });
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
