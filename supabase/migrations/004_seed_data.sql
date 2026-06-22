-- ============================================================
-- Migration 004: テスト・開発用シードデータ
-- ※ 本番環境では実行しないこと
-- ============================================================

-- prospect_weights が未登録の場合のみ挿入
INSERT INTO prospect_weights (rank, weight) VALUES
  ('a',     0.80),
  ('b',     0.50),
  ('other', 0.00)
ON CONFLICT (rank) DO NOTHING;

-- ============================================================
-- テストユーザーのプロフィールは auth.users 作成後に
-- supabase/seed_profiles.sql を別途実行してください
-- ============================================================

-- 本番デプロイ後の初期データ確認クエリ（コメントアウト済み）
-- SELECT count(*) FROM departments;        -- 3件
-- SELECT count(*) FROM prospect_weights;   -- 3件
-- SELECT count(*) FROM roles;              -- 4件
