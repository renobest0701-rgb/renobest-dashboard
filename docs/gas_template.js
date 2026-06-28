/**
 * RENOBEST CRM - Google Apps Script テンプレート
 *
 * 設定:
 *   スクリプトプロパティ（スクリプトエディタ > プロジェクトの設定 > スクリプトプロパティ）に以下を設定:
 *   - API_URL    : https://your-app.vercel.app/api/sync/customers
 *   - API_SECRET : INTERNAL_API_SECRETの値
 *
 * スプレッドシート構成:
 *   シート名「顧客登録」に以下の列を作る（1行目がヘッダー）
 *   A: 顧客名 (必須)
 *   B: 電話番号
 *   C: メールアドレス
 *   D: LINE名
 *   E: 言語 (ja/en/zh など)
 *   F: 顧客種別 (individual/corporate)
 *   G: ランク (a/b/c/d)
 *   H: 反響元
 *   I: 担当者メール
 *   J: ステータス (active/inactive/lost)
 *   K: 接触状況 (not_contacted/contacted/meeting_set)
 *   L: 最終接触日 (YYYY-MM-DD)
 *   M: 次回予定日 (YYYY-MM-DD)
 *   N: メモ
 *   O: 同期状況（スクリプトが自動記入）
 *   P: 同期日時（スクリプトが自動記入）
 *   Q: 顧客ID（スクリプトが自動記入）
 */

// ============================================================
// メイン: シート追加・編集時に呼ばれるトリガー関数
// ============================================================
function onEdit(e) {
  const sheet = e.source.getActiveSheet()
  if (sheet.getName() !== '顧客登録') return

  const row = e.range.getRow()
  if (row <= 1) return // ヘッダー行はスキップ

  // A列（顧客名）が入力されたときだけ同期
  const customerName = sheet.getRange(row, 1).getValue()
  if (!customerName) return

  // 同期済みでないか確認（O列が空ならまだ）
  const syncStatus = sheet.getRange(row, 15).getValue()
  if (syncStatus === '同期済') return

  syncRow(sheet, row)
}

// ============================================================
// 一括同期: メニューから手動実行
// ============================================================
function syncAllRows() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const sheet = ss.getSheetByName('顧客登録')
  if (!sheet) {
    SpreadsheetApp.getUi().alert('「顧客登録」シートが見つかりません')
    return
  }

  const lastRow = sheet.getLastRow()
  if (lastRow <= 1) {
    SpreadsheetApp.getUi().alert('データがありません')
    return
  }

  let successCount = 0
  let errorCount = 0

  for (let row = 2; row <= lastRow; row++) {
    const customerName = sheet.getRange(row, 1).getValue()
    if (!customerName) continue

    try {
      const result = syncRow(sheet, row)
      if (result) successCount++
      else errorCount++
    } catch (err) {
      errorCount++
      sheet.getRange(row, 15).setValue('エラー')
      sheet.getRange(row, 16).setValue(new Date().toLocaleString('ja-JP'))
    }

    Utilities.sleep(200) // API負荷軽減
  }

  SpreadsheetApp.getUi().alert(
    `同期完了: 成功 ${successCount} 件 / エラー ${errorCount} 件`
  )
}

// ============================================================
// 未同期行のみ同期
// ============================================================
function syncPendingRows() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const sheet = ss.getSheetByName('顧客登録')
  if (!sheet) return

  const lastRow = sheet.getLastRow()
  let count = 0

  for (let row = 2; row <= lastRow; row++) {
    const customerName = sheet.getRange(row, 1).getValue()
    const syncStatus = sheet.getRange(row, 15).getValue()
    if (!customerName || syncStatus === '同期済') continue

    syncRow(sheet, row)
    count++
    Utilities.sleep(200)
  }

  Logger.log(`未同期 ${count} 件を処理しました`)
}

// ============================================================
// 1行を同期する
// ============================================================
function syncRow(sheet, row) {
  const props = PropertiesService.getScriptProperties()
  const apiUrl = props.getProperty('API_URL')
  const apiSecret = props.getProperty('API_SECRET')

  if (!apiUrl) {
    Logger.log('API_URLが設定されていません')
    sheet.getRange(row, 15).setValue('設定エラー')
    return false
  }

  // シートの値を読み取る
  const values = sheet.getRange(row, 1, 1, 14).getValues()[0]

  const payload = {
    customer_name:        String(values[0] || '').trim(),
    phone:                formatPhone(String(values[1] || '')),
    email:                String(values[2] || '').trim().toLowerCase() || undefined,
    line_name:            String(values[3] || '').trim() || undefined,
    language:             String(values[4] || 'ja').trim() || 'ja',
    customer_type:        String(values[5] || 'individual').trim() || 'individual',
    rank:                 String(values[6] || 'c').trim().toLowerCase() || 'c',
    source:               String(values[7] || '').trim() || undefined,
    assigned_user_email:  String(values[8] || '').trim().toLowerCase() || undefined,
    status:               String(values[9] || 'active').trim() || 'active',
    first_contact_status: String(values[10] || 'not_contacted').trim() || 'not_contacted',
    last_contact_date:    formatDate(values[11]),
    next_action_date:     formatDate(values[12]),
    memo:                 String(values[13] || '').trim() || undefined,
    row_number:           row,
  }

  if (!payload.customer_name) return false

  // APIリクエスト
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': `Bearer ${apiSecret}`,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  }

  let response
  try {
    response = UrlFetchApp.fetch(apiUrl, options)
  } catch (err) {
    sheet.getRange(row, 15).setValue('通信エラー')
    sheet.getRange(row, 16).setValue(new Date().toLocaleString('ja-JP'))
    return false
  }

  const code = response.getResponseCode()
  const body = response.getContentText()

  if (code === 200 || code === 201) {
    const result = JSON.parse(body)
    const statusText = result.is_new ? '同期済' : '更新済'
    sheet.getRange(row, 15).setValue(statusText)
    sheet.getRange(row, 16).setValue(new Date().toLocaleString('ja-JP'))
    sheet.getRange(row, 17).setValue(result.customer_id || '')
    return true
  } else {
    sheet.getRange(row, 15).setValue(`エラー(${code})`)
    sheet.getRange(row, 16).setValue(new Date().toLocaleString('ja-JP'))
    Logger.log(`Row ${row} sync error: ${body}`)
    return false
  }
}

// ============================================================
// ユーティリティ
// ============================================================
function formatPhone(phone) {
  if (!phone) return undefined
  return phone.replace(/[^\d+\-]/g, '').trim() || undefined
}

function formatDate(value) {
  if (!value) return undefined
  if (value instanceof Date) {
    return Utilities.formatDate(value, 'Asia/Tokyo', 'yyyy-MM-dd')
  }
  const str = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  return undefined
}

// ============================================================
// カスタムメニュー（スプレッドシートを開いたときに追加）
// ============================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('RENOBEST同期')
    .addItem('未同期を同期', 'syncPendingRows')
    .addItem('全行を再同期', 'syncAllRows')
    .addToUi()
}
