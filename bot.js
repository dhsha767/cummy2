/*
  @title        Cummy 2.0
  @description  Re-code of Dank Memes Cummy bot
  @author       William Moody (@bmdyy#0068)
  @date         10.09.2019
*/

// --- --- --- --- --- --- --- ---

const Discord = require('discord.js'); // discord api
const PGClient = require('pg').Client; // postgresql
const http = require('http'); // http requests (for the heartbeat)

// --- --- --- --- --- --- --- ---

const pgClient = new PGClient({ // init postgresql client
  connectionString: process.env.DATABASE_URL,
});
pgClient.connect(); // connect to db
const client = new Discord.Client(); // init discord api client

// --- --- --- --- --- --- --- ---

client.on('ready', () => {
  console.log("CONNECTED");
  client.user.setPresence({ status: 'idle', game: {type: 'LISTENING', name: 'to Gitti VOs'}, afk: false, });
});

client.on('disconnect', (errMsg, code) => {
  console.log("DISCONNECTED");
  client.connect();
});

// --- --- --- --- --- --- --- ---

client.login(process.env.BOT_TOKEN); // login to discord api
setInterval(function(){ http.get("http://cummy2.herokuapp.com"); },300000); // make sure dyno doesn't fall asleep
