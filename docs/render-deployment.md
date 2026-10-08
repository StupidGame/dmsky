# Render で DMSKY を動かす

この構成は、Misskey の Web サーバーとジョブワーカーを同じ常駐 Docker サービスで起動します。PostgreSQL は投稿など、Render Key Value はキューとキャッシュ、永続ディスクはアップロードファイルを保存します。WebSocket によるストリーミングも Web サービスで処理します。

## 初回デプロイ

1. Render に GitHub アカウントを接続し、このリポジトリの `develop` ブランチから **Blueprint** を作成します。ルートの `render.yaml` を選びます。
2. 作成される **Web 2 CPU / 4 GB、PostgreSQL 0.5 CPU / 1 GB、Key Value 256 MB、ディスク 10 GB** は有料です。Render の作成画面に表示される料金を確認してから適用します。
3. 独自ドメインで公開するなら、最初の起動前に Web サービスの環境変数 `DMSKY_URL` を `https://example.org` の形式で設定し、DNS と Render のドメイン設定を済ませます。独自ドメインがなければ、Render が付与する `https://dmsky.onrender.com/` などの URL を使います。**初回起動後は URL を変更しないでください**。ActivityPub の識別子が変わります。
4. Web サービスの環境変数 `DMSKY_SETUP_PASSWORD` は Blueprint が自動生成します。Render の管理画面で値を確認し、初期管理者を作成するときに入力します。認証情報は Git に追加しないでください。
5. `https://<公開ホスト>/healthz` が正常になったら Web 画面から初期設定します。管理画面の「Repository URL」に、この公開リポジトリの URL を設定します。

起動スクリプトは Render が渡すプライベート接続 URL と公開 URL から `.config/default.yml` を生成し、マイグレーション後に Misskey を起動します。生成したファイルはコンテナ内だけに置き、権限を `0600` にします。画像などは `/misskey/files` に保存され、Render の永続ディスクに残ります。

ディスクが付いた Web サービスは 1 インスタンス構成です。デプロイ中は短時間停止します。容量が足りなくなればディスクを拡張できます。PostgreSQL とディスクのバックアップ方針は運用開始時に確認してください。
