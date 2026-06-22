import {
  LayoutDashboard, FolderOpen, Building2, Globe,
  Users, CheckSquare, History, TrendingUp, Bell,
  DollarSign, Upload, KeyRound, Settings, HelpCircle
} from 'lucide-react'

interface Section {
  icon: React.ReactNode
  title: string
  roles: string
  description: string
  usage: string[]
}

const sections: Section[] = [
  {
    icon: <LayoutDashboard className="w-5 h-5 text-blue-600" />,
    title: '個人成績',
    roles: '全ユーザー',
    description: '自分の今月の売上・利益目標に対する進捗を確認できます。契約ベース・入金ベースの売上、見込み利益、着地予測などをひと目で把握できます。',
    usage: [
      '月間売上目標・利益目標の達成率をプログレスバーで確認する',
      '契約済み・引渡し済み・入金済みの売上金額を確認する',
      '加重見込み利益で月末着地を予測する',
      '入金待ち案件の件数・金額・延滞状況を確認する',
    ],
  },
  {
    icon: <FolderOpen className="w-5 h-5 text-blue-600" />,
    title: '案件一覧',
    roles: '全ユーザー',
    description: '自分が担当する案件の一覧を表示します。ステータス・見込みランク・金額などで絞り込みができます。',
    usage: [
      '「新規登録」ボタンから案件を追加する',
      'ステータスや見込みランクでフィルタリングする',
      '案件名をクリックして詳細・編集画面を開く',
      '詳細画面からステータス変更・入金登録・重要変更申請を行う',
    ],
  },
  {
    icon: <Bell className="w-5 h-5 text-blue-600" />,
    title: '通知',
    roles: '全ユーザー',
    description: '自分の担当案件に関する通知（入金確認・承認結果など）を確認できます。',
    usage: [
      '過去30日間の通知を一覧で確認する',
      '通知をクリックして該当案件を開く',
    ],
  },
  {
    icon: <Building2 className="w-5 h-5 text-purple-600" />,
    title: '部門ダッシュボード',
    roles: '部門長・経理・経営者・非営業',
    description: '部門全体の売上・利益・目標達成率を確認できます。部門メンバーの実績比較も表示します。',
    usage: [
      '部門の月間・年間目標に対する進捗を確認する',
      'メンバーごとの売上・利益実績を比較する',
    ],
  },
  {
    icon: <Globe className="w-5 h-5 text-purple-600" />,
    title: '全社ダッシュボード',
    roles: '部門長・経理・経営者・非営業',
    description: '全社の売上・利益・目標達成率を部門別に集計して表示します。',
    usage: [
      '全社の月間・年間実績を確認する',
      '部門別の売上・利益を比較する',
    ],
  },
  {
    icon: <CheckSquare className="w-5 h-5 text-orange-600" />,
    title: '承認一覧',
    roles: '部門長・経理・経営者',
    description: '部下からの重要変更申請（売上金額・利益の大幅変更など）を承認・却下できます。',
    usage: [
      '申請一覧から内容を確認し「承認」または「却下」をクリックする',
      '却下時は理由を入力する',
    ],
  },
  {
    icon: <CheckSquare className="w-5 h-5 text-orange-600" />,
    title: '承認申請管理',
    roles: '部門長・経理・経営者',
    description: '承認申請の全件履歴を管理できます。ステータス・申請者・期間でフィルタリングできます。',
    usage: [
      'ステータス（未処理・承認済・却下）で絞り込む',
      '申請内容の詳細を確認する',
    ],
  },
  {
    icon: <TrendingUp className="w-5 h-5 text-green-600" />,
    title: '目標設定',
    roles: '部門長・経理・経営者',
    description: '全社・部門・個人ごとの月次/年次の売上・利益目標を設定します。',
    usage: [
      '「全社」タブで会社全体の年次・月次目標を入力する',
      '「部門別」タブで各部門の目標を入力する',
      '「個人別」タブで各メンバーの目標を入力する',
      '金額は万円単位で入力し「保存」をクリックする',
      '年度は左右の矢印で切り替える',
    ],
  },
  {
    icon: <DollarSign className="w-5 h-5 text-green-600" />,
    title: '販促費・固定経費',
    roles: '経理・経営者',
    description: '部門ごとの販促費（広告費・SNS・LINE等）と固定経費を管理します。利益計算に反映されます。',
    usage: [
      '月次の販促費をカテゴリ別に入力する',
      '固定経費（家賃・人件費等）を登録する',
    ],
  },
  {
    icon: <Users className="w-5 h-5 text-green-600" />,
    title: 'ユーザー管理',
    roles: '経理・経営者',
    description: '社員アカウントの一覧・ロール変更・部門変更・有効/無効の切替ができます。CSVで一括インポートも可能です。',
    usage: [
      'ロール列のドロップダウンからロールを変更する（即時保存）',
      '部門列のドロップダウンから所属部門を変更する',
      '状態列のボタンでアカウントを有効/無効に切り替える',
      'CSVインポートページからテンプレートに沿って一括登録する',
    ],
  },
  {
    icon: <History className="w-5 h-5 text-green-600" />,
    title: '月次締め',
    roles: '経理・経営者',
    description: '月次の仮締め・本締めを管理します。本締め後は案件がロックされ編集不可になります。',
    usage: [
      '月次を選択して「仮締め」を実行する',
      '最終確認後「本締め」を実行する（案件がロックされます）',
      '修正が必要な場合は「修正モード」で一時解除できます',
    ],
  },
  {
    icon: <History className="w-5 h-5 text-green-600" />,
    title: '変更履歴',
    roles: '経理・経営者',
    description: '案件・目標・経費などの変更操作の監査ログを確認できます。',
    usage: [
      '操作種別・対象・ユーザー・期間で絞り込む',
      '変更前後の値を確認する',
    ],
  },
  {
    icon: <Upload className="w-5 h-5 text-gray-600" />,
    title: 'CSVインポート',
    roles: '経理・経営者',
    description: '案件データとユーザーデータをCSVファイルで一括登録できます。',
    usage: [
      '「案件インポート」タブから案件CSVをアップロードする',
      '「ユーザーインポート」タブからユーザーCSVをアップロードする',
      'まず「ドライラン」で検証してからエラーを修正し「インポート実行」する',
      'CSVのフォーマットは画面内のサンプルを参照する',
    ],
  },
  {
    icon: <Bell className="w-5 h-5 text-gray-600" />,
    title: 'LINE通知設定',
    roles: '経理・経営者',
    description: 'LINE Messaging API を使った通知の設定・ログ確認・再送ができます。',
    usage: [
      '通知ログで送信結果（成功・失敗）を確認する',
      '失敗した通知を手動で再送する',
    ],
  },
  {
    icon: <KeyRound className="w-5 h-5 text-gray-600" />,
    title: 'サービス管理',
    roles: '経営者',
    description: '運営で使用する各種サービス（Supabase・Vercel・ポータルサイト等）のURL・ログインID・パスワードを安全に管理します。',
    usage: [
      '「サービスを追加」からサービス情報を登録する',
      'パスワードは目アイコンで表示/非表示を切り替える',
      'IDやパスワードはクリックでクリップボードにコピーできる',
      'URLをクリックすると新しいタブで開く',
    ],
  },
  {
    icon: <Settings className="w-5 h-5 text-gray-600" />,
    title: '設定',
    roles: '経理・経営者',
    description: 'システム全体の設定（見込み確度の加重値など）を変更できます。',
    usage: [
      '加重見込み確度（A・B・その他）の割合を変更する',
    ],
  },
]

const ROLE_COLOR: Record<string, string> = {
  '全ユーザー': 'bg-blue-50 text-blue-700',
  '部門長・経理・経営者・非営業': 'bg-purple-50 text-purple-700',
  '部門長・経理・経営者': 'bg-orange-50 text-orange-700',
  '経理・経営者': 'bg-green-50 text-green-700',
  '経営者': 'bg-red-50 text-red-700',
}

export default function HelpPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <HelpCircle className="w-7 h-7 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">ヘルプ</h1>
      </div>
      <p className="text-sm text-gray-500 mb-8">各機能の説明と使い方をご確認いただけます。</p>

      {/* ロール凡例 */}
      <div className="mb-8 p-4 bg-gray-50 rounded-xl border border-gray-200">
        <p className="text-xs font-semibold text-gray-500 mb-2">ロール（権限）について</p>
        <div className="flex flex-wrap gap-2 text-xs">
          {[
            { label: '営業（staff）',   color: 'bg-blue-100 text-blue-700' },
            { label: '部門長（manager）', color: 'bg-purple-100 text-purple-700' },
            { label: '経理（accounting）', color: 'bg-orange-100 text-orange-700' },
            { label: '経営者（executive）', color: 'bg-red-100 text-red-700' },
            { label: '非営業（non_sales）', color: 'bg-gray-100 text-gray-600' },
          ].map((r) => (
            <span key={r.label} className={`px-2.5 py-1 rounded-full font-medium ${r.color}`}>{r.label}</span>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">上位ロールは下位ロールの機能を含みます。ロールはユーザー管理ページで変更できます。</p>
      </div>

      <div className="space-y-4">
        {sections.map((s) => (
          <div key={s.title} className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 bg-gray-50 border-b border-gray-200">
              {s.icon}
              <span className="font-semibold text-gray-900">{s.title}</span>
              <span className={`ml-auto text-xs px-2.5 py-0.5 rounded-full font-medium ${ROLE_COLOR[s.roles] ?? 'bg-gray-100 text-gray-600'}`}>
                {s.roles}
              </span>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-gray-600 mb-3">{s.description}</p>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">使い方</p>
              <ul className="space-y-1">
                {s.usage.map((u, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    {u}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
