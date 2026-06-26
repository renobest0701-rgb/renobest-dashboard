# 提案書テンプレート配置ガイド

## 必要なファイル

このディレクトリに以下の2ファイルを配置してください：

- `proposal_template_base.html` — 管理用テンプレート
- `proposal_template_base_customer.html` — 顧客用テンプレート

## プレースホルダー仕様

テンプレート内で `{{key}}` 形式のプレースホルダーが差し替えられます。

### 物件基本情報
| プレースホルダー | 内容 |
|---|---|
| `{{property_name}}` | 物件名 |
| `{{property_slug}}` | ファイル名スラッグ |
| `{{price}}` | 価格 |
| `{{address}}` | 住所 |
| `{{access}}` | 交通アクセス |
| `{{area}}` | 専有面積 |
| `{{layout}}` | 間取り |
| `{{built}}` | 築年月 |
| `{{structure}}` | 構造 |
| `{{management_fee}}` | 管理費 |
| `{{repair_fee}}` | 修繕積立金 |
| `{{parking}}` | 駐車場 |
| `{{pet}}` | ペット可否 |
| `{{developer}}` | 分譲会社 |
| `{{total_units}}` | 総戸数 |
| `{{floor}}` | 階数 |

### テキスト（日本語）
| プレースホルダー | 内容 |
|---|---|
| `{{catchcopy}}` | キャッチコピー |
| `{{subtitle}}` | サブタイトル |
| `{{recommend_comment}}` | おすすめコメント |
| `{{summary}}` | 概要 |
| `{{plan_highlight}}` | 間取りポイント |
| `{{stage_title}}` | ステージタイトル |
| `{{stage_body}}` | ステージ本文 |
| `{{facilities}}` | 施設・設備（・区切り） |
| `{{rooms}}` | 部屋構成（・区切り） |
| `{{equipment}}` | 設備（・区切り） |
| `{{recommend_points}}` | おすすめポイント（`<li>`タグ列） |

### 4言語テキスト
| プレースホルダー | 内容 |
|---|---|
| `{{ja_catchcopy}}` | 日本語キャッチコピー |
| `{{ja_summary}}` | 日本語概要 |
| `{{ja_recommend_comment}}` | 日本語おすすめコメント |
| `{{ja_stage_body}}` | 日本語ステージ本文 |
| `{{en_catchcopy}}` | 英語キャッチコピー |
| `{{en_summary}}` | 英語概要 |
| `{{en_recommend_comment}}` | 英語おすすめコメント |
| `{{en_stage_body}}` | 英語ステージ本文 |
| `{{zhcn_catchcopy}}` | 简体中文キャッチコピー |
| `{{zhcn_summary}}` | 简体中文概要 |
| `{{zhcn_recommend_comment}}` | 简体中文おすすめコメント |
| `{{zhcn_stage_body}}` | 简体中文ステージ本文 |
| `{{zhtw_catchcopy}}` | 繁體中文キャッチコピー |
| `{{zhtw_summary}}` | 繁體中文概要 |
| `{{zhtw_recommend_comment}}` | 繁體中文おすすめコメント |
| `{{zhtw_stage_body}}` | 繁體中文ステージ本文 |

### 画像スロット（Data URL または 相対パス）
| プレースホルダー | 内容 |
|---|---|
| `{{img_hero}}` | ヒーロー画像 src |
| `{{img_lifestyle}}` | ライフスタイル画像 src |
| `{{img_floorplan}}` | 間取り図 src（切り出し済み） |
| `{{img_area0}}` | エリア写真① src |
| `{{img_area1}}` | エリア写真② src |
| `{{img_area2}}` | エリア写真③ src |
| `{{img_common0}}` | 共用部① src |
| `{{img_common1}}` | 共用部② src |
| `{{img_common2}}` | 共用部③ src |
| `{{img_logo}}` | RENOBESTロゴ src |
| `{{img_qr_line}}` | LINE QR src |
| `{{img_qr_wechat}}` | WeChat QR src |

## 使用例（テンプレートHTMLの記述例）

```html
<img src="{{img_hero}}" alt="外観" class="hero-img" />
<h1 data-key="catchcopy">{{ja_catchcopy}}</h1>
<p class="price">{{price}}</p>
```

## 顧客用テンプレートの注意事項

顧客用テンプレートからは以下が自動除去されます：
- `type="file"` の input 要素
- `contenteditable` 属性
- `saveHTML` / `saveForCustomer` / `generateDM` / `setupImgReplace` を含む onclick
- 管理者用ヒント（class="admin-hint"）
- 画像変更オーバーレイ（class="img-replace-overlay"）

以下は顧客用でも必ず残してください：
- 日本語・English・中文简体・中文繁體 の言語切り替えボタン
- PDF印刷ボタン
- LINE QR / WeChat QR
- RENOBESTロゴ
- 連絡先導線
- P1/P2/P3 ページ要素
- footer
- setLang / T / TB 関数
