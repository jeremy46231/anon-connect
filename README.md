# AnonConnect

Anonymously chat with random people!

Send a DM to [@AnonChat][anonchat] on [Slack][slack], or, for provable anonymity
(you don't have to trust me), [send the bot a DM][simplex-dm] on
[SimpleX][simplex].

[anonchat]: https://hackclub.slack.com/team/U09C3KYP07N
[slack]: https://hackclub.com/slack
[simplex-dm]:
  https://smp5.simplex.im/a#hbD_dWPQ5wj2z7K64JvtPPPkG4gcOycn6Q-kTp0MuvE
[simplex]: https://simplex.chat

```sh
# Install the SimpleX CLI
curl -o- https://raw.githubusercontent.com/simplex-chat/simplex-chat/stable/install.sh | bash
# https://simplex.chat/docs/cli.html#installation

# Install dependencies
bun install

# In one shell, run the SimpleX server
bun run simplex
# At the same time, run the bot
bun run src/main.ts
```
