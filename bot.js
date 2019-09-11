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

const keepAlive_url = "http://cummy2.herokuapp.com"; // url to ping cummy
const keepAlive_interval = 5 * 60 * 1000; // in milliseconds
const presence = {status:'idle',game:{type:'LISTENING',name:'Trance - 009 Sound System Dreamscape (HD)'}}; // type PresenceData

// --- --- --- INITS --- --- ---

const pgClient = new PGClient({ // init postgresql client
  connectionString: process.env.DATABASE_URL,
});
pgClient.connect(); // connect to db
const client = new Discord.Client(); // init discord api client
client.login(process.env.BOT_TOKEN); // login to discord api
setInterval(function() {
  http.get(keepAlive_url);
}, keepAlive_interval); // make sure dyno doesn't fall asleep

// --- --- --- FUNCS --- --- ---

// --- --- --- HOOKS --- --- ---

client.on('ready', () => {
  console.log("CONNECTED");
  client.user.setPresence(presence);
});

client.on('message', (message) => {
  console.log("MESSAGE");
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
