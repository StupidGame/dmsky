# DMSKY を月額 0 円で動かす

Oracle Cloud の **Always Free 対象** Arm VM 1 台に、Misskey、PostgreSQL、Redis、Nginx、アップロードファイルを置く構成です。ドメインには無料の DuckDNS サブドメイン、HTTPS には Let's Encrypt を使います。Render の有料 Blueprint は使いません。

Oracle の現行 Always Free 上限は Ampere A1 が合計 **2 OCPU / 12 GB RAM**、ブートボリュームを含む Block Volume が合計 **200 GB** です。最初は **1 OCPU / 6 GB RAM** を選び、空きがあれば 2 OCPU / 12 GB に増やせます。無料対象の空きがない地域では VM を作れないことがあります。また、アイドル状態の無料 VM は回収される場合があります。料金が発生しないことを Oracle の作成画面で確かめ、無料対象外のリソースやアカウントの有料アップグレードを選ばないでください。

## 1. Oracle Cloud で VM を作る

1. Oracle Cloud コンソールの **Compute → Instances → Create instance** を開き、ホームリージョンに作成します。
2. **Always Free Eligible** と表示される **Ubuntu 24.04** の Arm イメージと `VM.Standard.A1.Flex` を選び、まず **1 OCPU / 6 GB RAM** にします。利用可能なら **2 OCPU / 12 GB RAM** でも構いません。容量不足と表示されたら、ホームリージョン内の別の Availability Domain を試すか、空きを待ちます。AMD の無料 Micro VM は 1 GB RAM のため、このインストーラーの要件を満たしません。
3. ブートボリュームは既定の **50 GB** とし、公開サブネットとパブリック IPv4 を割り当てます。SSH 公開鍵を登録して秘密鍵を手元に保存します。
4. VM のセキュリティリストまたは Network Security Group で、TCP **80 / 443** をインターネットから、TCP **22** を自分の接続元から許可します。Ubuntu 側のファイアウォールも有効なら 80 / 443 を許可します。PostgreSQL の 5432 と Redis の 6379 は公開しません。

6 GB の VM ではインストーラーがビルド用に 4 GB のスワップを作ります。A1 がどの Availability Domain でも作れない場合、現在確認できる他社の恒久無料 VM にはこの構成を一式で安定稼働させる容量がありません。Oracle の無料枠の空きを待つ必要があります。

## 2. DuckDNS の名前を取る

[DuckDNS](https://www.duckdns.org/) で無料の名前を登録します。例えば `my-dmsky.duckdns.org` です。表示されるトークンは Git やチャットに貼らず、VM の root 専用ファイルに保存します。

```bash
ssh -i <SSH秘密鍵のパス> ubuntu@<VMのパブリックIP>
sudo install -m 0600 /dev/null /root/dmsky-duckdns-token
sudo nano /root/dmsky-duckdns-token
```

エディターに DuckDNS のトークン **1 行だけ** を入力して保存します。インストーラーは初回に DNS を更新し、その後は systemd タイマーで 5 分ごとに更新します。

## 3. インストール

VM で次を実行します。メールアドレスは Let's Encrypt の通知用です。

```bash
curl -fsSLO https://raw.githubusercontent.com/StupidGame/dmsky/develop/scripts/install-dmsky-ubuntu.sh
sudo bash install-dmsky-ubuntu.sh --check
sudo bash install-dmsky-ubuntu.sh --domain my-dmsky.duckdns.org --email you@example.com --duckdns-token-file /root/dmsky-duckdns-token
```

`my-dmsky.duckdns.org` と `you@example.com` を自分の値に置き換えます。DNS の反映直後に証明書取得が失敗した場合は、DNS が VM の IP を返すまで待ち、`sudo certbot --nginx -d my-dmsky.duckdns.org` を再実行してください。途中まで作成された環境にインストーラーを再実行しないでください。

## 4. 起動確認

```bash
sudo systemctl status dmsky.service dmsky-duckdns.timer
curl -fsS https://my-dmsky.duckdns.org/healthz
sudo cat /root/dmsky-setup-password
```

ブラウザーで HTTPS の URL を開き、表示された初期設定パスワードで管理者を作成します。管理画面の「Repository URL」は `https://github.com/StupidGame/dmsky` に設定します。投稿、画像アップロード、ストリーミング、外部インスタンスとの連合を順に試してください。**運用開始後に URL を変更すると ActivityPub の識別子が変わるため、DuckDNS の名前を維持してください。**

メール通知やパスワード再設定メールを使う場合は、別途 SMTP を設定してください。Oracle は Email Delivery の無料送信枠を案内していますが、アカウント側の送信上限、送信者の認証、SMTP 資格情報を先に確認する必要があります。これらを設定するまでメール機能は使えません。バックアップは PostgreSQL のダンプと `/var/lib/dmsky/app/files` を両方保存してください。

公式資料: [Oracle Always Free の対象と上限](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)、[Oracle の無料枠アカウント](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm)、[DuckDNS API](https://www.duckdns.org/spec.jsp)、[Let's Encrypt のポート 80](https://letsencrypt.org/docs/allow-port-80/)。
