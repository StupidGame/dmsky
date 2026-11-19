# DMSKY Ubuntu インストーラー

`install-dmsky-ubuntu.sh` は [Misskey 公式の Ubuntu インストーラー](https://github.com/joinmisskey/bash-install/blob/main/ubuntu.sh) の手順を参考にした、このフォーク用の新規導入スクリプトです。Ubuntu 24.04 の新しいサーバーで、PostgreSQL、Redis、Node.js 26、pnpm、Nginx、HTTPS、systemd サービスを設定します。既存の `/var/lib/dmsky/app` と `dmsky.service` は上書きしません。

**月額 0 円で試す場合は [Oracle Cloud Always Free + DuckDNS 手順](../docs/free-oci-deployment.md) を使用してください。** DuckDNS トークンを root 専用ファイルから読み取り、DNS の自動更新を設定します。

実行前にドメインの DNS をサーバーへ向け、ポート 80 と 443 を開いてください。少なくとも 4 GB のメモリを推奨します。

```bash
curl -fsSLO https://raw.githubusercontent.com/StupidGame/dmsky/develop/scripts/install-dmsky-ubuntu.sh
sudo bash install-dmsky-ubuntu.sh --check
sudo bash install-dmsky-ubuntu.sh --domain example.com --email admin@example.com
```

インストール後、`/root/dmsky-setup-password` のパスワードで初期管理者を作成します。その後、管理画面の「リポジトリURL」に `https://github.com/StupidGame/dmsky` を設定してください。設定ファイルは `/var/lib/dmsky/app/.config/default.yml` に作成されます。更新時はこのスクリプトを再実行せず、バックアップを取得してから Git と pnpm で更新してください。

## Discordログインを設定する

[Discord Developer Portal](https://discord.com/developers/applications) でApplicationを作り、OAuth2のRedirectsに `https://example.com/auth/discord/callback` を登録します。`example.com` は公開ドメインに置き換えます。Botは不要です。

対話形式で設定する場合は `--discord` を追加します。Client IDとClient Secretを尋ねます。Secretは非表示で入力し、アプリユーザーだけが読める `.config/default.yml` に保存します。

```bash
sudo bash install-dmsky-ubuntu.sh --domain example.com --email admin@example.com --discord
```

無人導入ではClient IDと、root所有・権限`0600`のSecretファイルを指定します。Secret自体をコマンド引数に渡しません。

```bash
sudo install -m 0600 /dev/null /root/dmsky-discord-secret
sudo nano /root/dmsky-discord-secret
# Client Secretを1行だけ保存する
sudo bash install-dmsky-ubuntu.sh --domain example.com --email admin@example.com \
  --discord-client-id 123456789012345678 \
  --discord-client-secret-file /root/dmsky-discord-secret
```

DuckDNSを使う場合は `--duckdns-token-file` と併用できます。Discordの設定を省略した場合、Discordログインは無効です。導入後、通常の方法でログインして **設定 → セキュリティ** でアカウントを連携します。既存環境への設定追加は [README](../README.md#discordログインの設定) の手順を使い、インストーラーを再実行しないでください。
