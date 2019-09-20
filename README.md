# Cummy2

Re-code of the original Cummy, to be used on the Dank Memes server. <br>
_William Moody 10.09.2019_ <br>

## General

**Voting system**

Probably the biggest changes since the old Cummy. Upvotes and downvotes are now stored as seperate counters. Upvoting is no longer free, in that upvoting a meme sends karma from you to the person who posted. Downvotes are only used to calculate position in the leaderboard, and they are reset alongside MotW (every week on Monday @ 00:00 GMT Time). The 6 ways to vote on a meme are as follows:

1. ![downvote.png](https://i.imgur.com/Z7iqkc3.png) counts as a downvote.
2. ![upvote_1.png](https://i.imgur.com/BkOxSG1.png) counts as +1 upvotes.
3. ![upvote_10.png](https://i.imgur.com/IvHxEaJ.png) counts as +10 upvotes.
4. ![upvote_25.png](https://i.imgur.com/G5dX1cD.png) counts as +25 upvotes.
5. ![upvote_50.png](https://i.imgur.com/4C3kecD.png) counts as +50 upvotes.
6. ![upvote_100.png](https://i.imgur.com/zYcoMMR.png) counts as +100 upvotes.

_Deleting a meme does NOT reverse any downvotes/upvotes_

_All karma sent by reacting on a meme is reversible simply by unreacting_

**Leaderboard ranking**

Leaderboard position is not just based on karma. In my opinion, this was a flaw with the original Cummy which promoted spamming memes. Position is now determined by average karma per meme, number of memes posted, and how long ago the person last posted a meme. More concretely:

1. _Only people who posted in the last 7 days appear on the leaderboard._
2. _Only people who have posted 5+ memes (total) appear on the leaderboard._
3. _People who meet conditions 1. and 2. are then ordered by `A = a-(d/10)` (A = adjusted average karma per meme) where a is avg. kpm and d is downvotes._
4. _Number of Meme of the Day / Meme of the Week awards does not influence position on the leaderboard._

_Condition 1_ is to prevent people who posted memes a long time ago from remaining at the top of the leaderboard despite being innactive in recent times. _Condition 2_ is to get a sense of avg. kpm over multiple memes. _Condition 3_ is to promote posting higher quality memes. Spamming low quality memes which get 0 or 1 upvotes will negatively impact the avg. kpm.

**Meme of the day/week**

Cummy2 posts a channel link to the day's/week's most upvoted meme (disregarding downvotes), so that people who are less active can get a quick recap.

At the end of each day/week, the author of the respective top meme recives a MotD or MotW award (Displays near name in leaderboard/karma/comparisons).

_The day begins at 00:00 GMT Time, and weeks begin on Mondays at the same time._

**Transaction log**

A log of the 10 most recent transactions is updated for all to see if they do desire. Cummy2 does not retain this information, it's mostly just to see where people are sending their karma currently.

## Commands
_\<opt:...\> indicates an optional parameter, \<req:...\> indicates a required parameter_

**!help**

_usage:_ `!help` <br>
Cummy2 sends a link to this file in the channel.


**!karma**

_usage:_ `!karma (opt:<username>#<discriminator>)` <br>
Cummy2 returns information on either the sender's, or the specified user's karma.


**!sendkarma**

_usage:_ `!sendkarma (req:<username>#<discriminator>) <req:amount>` <br>
Given that you posess the amount of karma to be sent, Cummy2 transfers the karma from you to the specified user. 
_This is an irreversible transaction of karma._

**!compare**

_usage:_ `!compare (req:<username>#<discriminator>) (opt:<username>#<discriminator>)` <br>
Cummy2 returns an embed with information about both users side by side. If the second username isn't specified then the user is compared to the sender.

**!nm**

_usage:_ `!nm ...` <br>
Cummy2 will not count the following message as a meme and/or react to it.

**!sql**

_usage:_ `!sql (req:<query>)` <br>
Cummy2 runs the issued query on it's database and returns the result in chat. *Only bmdyy#0068 can use this command*, all other users trying will be ignored.

**!js**

_usage:_ `!js (req:<statement>)` <br>
Cummy2 runs the issued statement in javascript and returns the result in chat. *Only bmdyy#0068 can use this command*, all other users trying will be ignored.

## API

Coming in the future (maybe), is an API for people to write their own bots which work with the karma system with. Getting user info, transferring karma, etc.
