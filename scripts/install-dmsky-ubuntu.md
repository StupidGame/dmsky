# DMSKY Ubuntu インストーラー

`install-dmsky-ubuntu.sh` は [Misskey 公式の Ubuntu インストーラー](https://github.com/joinmisskey/bash-install/blob/main/ubuntu.sh) の手順を参考にした、このフォーク用の新規導入スクリプトです。Ubuntu 24.04 の新しいサーバーで、PostgreSQL、Redis、Node.js 24、pnpm、Nginx、HTTPS、systemd サービスを設定します。既存の `/var/lib/dmsky/app` と `dmsky.service` は上書きしません。

実行前にドメインの DNS をサーバーへ向け、ポート 80 と 443 を開いてください。少なくとも 4 GB のメモリを推奨します。

```bash
curl -fsSLO https://raw.githubusercontent.com/StupidGame/dmsky/develop/scripts/install-dmsky-ubuntu.sh
sudo bash install-dmsky-ubuntu.sh --check
sudo bash install-dmsky-ubuntu.sh --domain example.com --email admin@example.com
```

インストール後、`/root/dmsky-setup-password` のパスワードで初期管理者を作成します。その後、管理画面の「リポジトリURL」に `https://github.com/StupidGame/dmsky` を設定してください。設定ファイルは `/var/lib/dmsky/app/.config/default.yml` に作成されます。更新時はこのスクリプトを再実行せず、バックアップを取得してから Git と pnpm で更新してください。
