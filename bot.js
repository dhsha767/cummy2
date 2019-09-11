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
const COMMANDS [ // {name, handler func}
  {name:'karma', func:getKarma}
];

// --- --- --- INITS --- --- ---

const pgClient = new PGClient({ // init postgresql client
  connectionString: process.env.DATABASE_URL,
});
pgClient.connect(); // connect to db
const client = new Discord.Client(); // init discord api client
client.login(process.env.BOT_TOKEN); // login to discord api
setInterval(function() {
  http.get(KEEPALIVE_URL);
}, KEEPALIVE_INTERVAL); // make sure dyno doesn't fall asleep

// --- --- --- FUNCS --- --- ---

function getKarma()
{
  console.log("GETKARMA");
}

// --- --- --- HOOKS --- --- ---

client.on('ready', () => {
  console.log("CONNECTED");
  client.user.setPresence(PRESENCE);
});

client.on('message', (message) => {
  console.log("MESSAGE");
  if (message.content == '!karma')
  {
    COMMANDS[0].func();
  }
});

client.on('messageDelete', (message) => {
  console.log("MESSAGEDELETE");
});

client.on('messageReactionAdd', (messageReaction, user) => {
  console.log("MESSAGEREACTIONADD");
});

client.on('messageReactionRemove', (messageReaction, user) => {
  console.log("MESSAGEREACTIONREMOVE");
});

client.on('disconnect', (event) => {
  console.log("DISCONNECTED");
  client.connect();
});
