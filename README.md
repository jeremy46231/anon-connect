# AnonConnect

Anonymously chat with random people!

Send a DM to [@AnonChat][slack-bot] on [Slack][slack], or, for provable
anonymity (you don't have to trust me), [send the bot a
message][simplex-address] on [SimpleX][simplex].

[slack-bot]: https://hackclub.slack.com/team/U09C3KYP07N
[slack]: https://hackclub.com/slack
[simplex-address]:
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
bun run start
```

## Run as systemd services (system-wide, runs as your current user)

Install and enable (uses sudo to install system-wide, but each service runs as your current non-root user with your current shell’s Bun path):

```bash
# From repo root
USER_NAME="$(id -un)" WORKDIR="$(pwd)" BUN_BIN="$(which bun)" SIMPLEX_BIN="$(which simplex-chat)" && \
  tmpdir="$(mktemp -d)" && \
  sed "s|__WORKDIR__|${WORKDIR}|g; s|__SIMPLEX__|${SIMPLEX_BIN}|g; s|__USER__|${USER_NAME}|g" systemd/anonconnect-simplex.service > "$tmpdir/anonconnect-simplex.service" && \
  sed "s|__WORKDIR__|${WORKDIR}|g; s|__BUN__|${BUN_BIN}|g; s|__USER__|${USER_NAME}|g" systemd/anonconnect-bot.service > "$tmpdir/anonconnect-bot.service" && \
  sudo cp "$tmpdir/anonconnect-"*.service /etc/systemd/system/ && \
  rm -rf "$tmpdir" && \
  sudo systemctl daemon-reload && \
  sudo systemctl enable anonconnect-simplex.service anonconnect-bot.service && \
  sudo systemctl start anonconnect-simplex.service anonconnect-bot.service
```

Check status and logs:

```bash
systemctl status anonconnect-simplex.service
systemctl status anonconnect-bot.service
journalctl -u anonconnect-simplex.service -f
journalctl -u anonconnect-bot.service -f
```

Uninstall:

```bash
sudo systemctl disable --now anonconnect-bot.service anonconnect-simplex.service
sudo rm -f /etc/systemd/system/anonconnect-*.service
sudo systemctl daemon-reload
```
