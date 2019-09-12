# Cummy2

Re-code of the original Cummy, to be used on the Dank Memes server. <br>
_William Moody 10.09.2019_ <br>

## Commands

**!help**

_usage:_ `!help` <br>
Cummy2 sends a link to this file in the channel.


**!karma**

_usage:_ `!karma (opt:<username>#<discriminator>)` <br>
Cummy2 returns information on either the sender's, or the specified user's karma.


**!sendkarma**

_usage:_ `!sendkarma (req:<username>#<discriminator>) <req:amount>` <br>
Given that you posess the amount of karma to be sent, Cummy2 transfers the karma from you to the specified user.

**!compare**

_usage:_ `!compare (req:<username>#<discriminator>) (opt:<username>#<discriminator>)` <br>
Cummy2 returns an embed with information about both users side by side. If the second username isn't specified then the user is compared to the sender.

**!sql**

_usage:_ `!sql (req:<query>)` <br>
Cummy2 runs the issued query on it's database and returns the result in chat. *Only bmdyy#0068 can use this command*, all other users trying will be ignored.

###### _\<opt:...\> indicates an optional parameter, \<req:...\> indicates a required parameter_

## API

_To-Do_
