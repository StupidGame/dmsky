<div align="center">
  <img src="./packages/frontend/assets/dmsky-icon.svg" alt="DMSKYのアイコン" width="160"/>
  <h1>DMSKY</h1>
  <p>近未来の回路と空をイメージした、Misskeyベースの分散型SNS。</p>
</div>

DMSKYは [Misskey](https://github.com/misskey-dev/misskey) のフォークです。ノート、リアクション、ドライブ、チャット、ActivityPubによる他サーバーとの連合など、Misskeyの機能を基盤に、専用デザイン・利用規約・Discordログイン・導入支援を追加しています。Misskey公式、Misskey.io、Discordが運営するサービスではありません。

## 元のMisskeyとの変更点

このフォークはMisskey **2026.10.0** 系をベースにしています。上流の取り込み起点は [`5f501341d4`](https://github.com/misskey-dev/misskey/commit/5f501341d4) です。

| 項目 | DMSKYでの変更 |
| --- | --- |
| デザイン | 専用のライト・ダークテーマ、回路風の装飾、都市の背景、ウェルカム画面・ナビゲーションの調整 |
| アイコン・文字ロゴ | 青い六角形と星を使ったDMSKY専用アイコン。favicon、Apple Touch Icon、PWAアイコンにも適用。`misskey.svg` は既存の都市・エンブレム素材に合わせた金属風のDMSKY文字ロゴに変更 |
| Discordログイン | 既存アカウントへのDiscord連携・解除、Discord経由のログイン。DMSKY側の二要素認証も継続 |
| 利用規約 | `/terms` ページ、登録前の規約確認、メニュー・サーバー紹介からの導線、管理者の追加規約へのリンク |
| フォークの表記 | ウェルカム画面や「Misskeyについて」にDMSKYの説明とこのリポジトリへのリンクを追加 |
| Ubuntu導入 | Ubuntu 24.04用の新規インストーラー。DB・Redis・Node.js・Nginx・HTTPS・systemdを設定。Discord設定にも対応 |
| デプロイ | Oracle Cloud + DuckDNSの導入手順、DNS自動更新スクリプト、RenderのBlueprint・設定生成・起動スクリプト |

独自規約には、宗教・政治・投資に関する発言の禁止と、オラクル教団の布教に限る例外が含まれます。これはDMSKY側の規約であり、Misskey全体の規約ではありません。導入前に [規約の実装](./packages/frontend/src/pages/terms.vue) と [文言](./locales/ja-JP.yml) を確認してください。

## インストール

新しいUbuntu 24.04サーバーで動かす場合は [Ubuntuインストーラーの手順](./scripts/install-dmsky-ubuntu.md) を参照してください。既存のDMSKY環境にインストーラーを再実行しないでください。

- [Oracle Cloud Always Free + DuckDNSでの導入](./docs/free-oci-deployment.md)：無料対象のVMと無料サブドメインを使う構成。対象・空き状況は各サービスで確認してください。
- [Renderへの導入](./docs/render-deployment.md)：常駐Webサービス、PostgreSQL、Redis、永続ディスクを使う有料構成。
- [Misskey公式の構築ガイド](https://misskey-hub.net/docs/for-admin/install/guides/)：手動構築する場合の基礎資料。ソースにはこのDMSKYリポジトリを使用してください。

```bash
curl -fsSLO https://raw.githubusercontent.com/StupidGame/dmsky/develop/scripts/install-dmsky-ubuntu.sh
sudo bash install-dmsky-ubuntu.sh --check
sudo bash install-dmsky-ubuntu.sh --domain example.com --email admin@example.com --discord
```

`--discord` を指定するとClient IDとClient Secretを入力します。Secretは画面に表示されません。Discordを使わない場合はこのオプションを省略できます。無人導入用のファイル指定は [インストーラーの手順](./scripts/install-dmsky-ubuntu.md) に記載しています。

導入後は、管理画面の「リポジトリURL」を `https://github.com/StupidGame/dmsky` に設定してください。稼働開始後の公開URLの変更は、ActivityPubの識別子に影響します。

## Discordログインの設定

1. [Discord Developer Portal](https://discord.com/developers/applications) でApplicationを作成します。OAuth2のClient IDとClient Secretを取得します。Botの追加は不要です。
2. OAuth2のRedirectsに **`https://あなたのホスト/auth/discord/callback`** を登録します。DMSKYの公開URLと一致させてください。
3. インストーラーの `--discord` を使うか、既存環境の `.config/default.yml` に以下を追加します。Client IDは文字列として引用符で囲みます。

```yaml
discord:
  clientId: 'YOUR_DISCORD_CLIENT_ID'
  clientSecret: 'YOUR_DISCORD_CLIENT_SECRET'
```

環境変数 `DMSKY_DISCORD_CLIENT_ID` と `DMSKY_DISCORD_CLIENT_SECRET` でも設定できます。YAMLに `discord` がある場合はそちらが優先されます。Renderではこの2つの環境変数を設定すると、起動時の設定生成に反映されます。両方を空にすると無効です。

4. 更新を導入する場合はDBとアップロードファイルをバックアップし、依存関係の更新・ビルド・マイグレーションを行って再起動します。Ubuntuインストーラーで導入済みの環境は、アプリユーザーの `dmsky` で実行します。

```bash
cd /var/lib/dmsky/app
pnpm install --frozen-lockfile
pnpm build
pnpm migrate
# 設定変更後、管理者が sudo systemctl restart dmsky を実行
```

5. 通常の方法でDMSKYにログインし、**設定 → セキュリティ → Discordログイン → Discordを連携する** を選びます。以降はログイン画面の「Discordでログイン」が使えます。同じ設定画面で連携を解除できます。

Discordログインは既存アカウント向けです。Discord経由の新規登録や、メールアドレスによる自動連携は行いません。1つのDiscordアカウントを複数のDMSKYアカウントへ連携することはできません。連携・解除にはパスワードと、有効な場合は認証コードまたはバックアップコードが必要です。ログインでは認証コード・バックアップコード・登録済みパスキーに対応します。認証に失敗した場合は最初からやり直してください。

取得権限はユーザー識別用の `identify` のみです。DiscordのユーザーIDを保存し、Discordのアクセストークン・リフレッシュトークンは保存しません。公開URLやリダイレクト先にDMSKYのログイントークンを含めません。認証方式は [Discord公式OAuth2仕様](https://docs.discord.com/developers/topics/oauth2) に従います。Client SecretをGitや公開ログに載せないでください。

## 開発

Node.jsの対応バージョンは [backendのpackage.json](./packages/backend/package.json)、pnpmのバージョンは [ルートのpackage.json](./package.json) を参照してください。

```bash
pnpm install --frozen-lockfile
# .config/example.ymlを参考に.config/default.ymlとローカルDB・Redisを準備
pnpm build
pnpm migrate
pnpm dev
```

変更時の規約は [AGENTS.md](./AGENTS.md) と [CONTRIBUTING.md](./CONTRIBUTING.md) を参照してください。アイコンのSVGからPNG・ICOを再生成する場合は、依存関係の導入後に `node scripts/build-dmsky-icons.mjs` を実行します。

## ライセンスと謝辞

DMSKYはMisskeyとその貢献者の成果を基盤にしています。上流の情報は [Misskey Hub](https://misskey-hub.net/)・[Misskeyのソースコード](https://github.com/misskey-dev/misskey)・[CHANGELOG](./CHANGELOG.md) を参照してください。

本体は [GNU AGPL v3](./LICENSE) です。`packages/misskey-js` などのサブパッケージはそれぞれのライセンスに従います。改変したサーバーを公開運用する場合も、適用されるライセンスに従ってソースコードを提供してください。
