INSERT INTO articles (id, original_url, title, status, metadata_status, saved_at, read_at, created_at, updated_at)
VALUES ('fixture-read', 'https://example.com/read', '日本語と引用符 '' title', 'read', 'ready', '2026-09-01T00:00:00.000Z', '2026-09-18T15:00:00.000Z', '2026-09-01T00:00:00.000Z', '2026-09-18T15:00:00.000Z'),
('fixture-unread', 'https://example.com/unread', NULL, 'unread', 'pending', '2026-09-01T00:00:00.000Z', NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
INSERT INTO article_urls VALUES ('https://example.com/read', 'fixture-read', 'original', '2026-09-01T00:00:00.000Z'), ('https://example.com/canonical', 'fixture-read', 'canonical', '2026-09-01T00:00:00.000Z');
INSERT INTO tags VALUES ('fixture-tag', '技術', '技術', 359, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
INSERT INTO article_tags VALUES ('fixture-read', 'fixture-tag', '2026-09-01T00:00:00.000Z');
INSERT INTO daymark_habits VALUES ('fixture-check', 'チェック', 'check', '2026-09-01', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'), ('fixture-number', '数値', 'number', '2026-09-01', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
INSERT INTO daymark_habit_versions VALUES ('fixture-v1', 'fixture-check', '2026-09-01', 'check', 'active', NULL, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'), ('fixture-v2', 'fixture-number', '2026-09-01', 'number', 'active', 1000000000000, '単位', 'at_least', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
INSERT INTO daymark_records VALUES ('fixture-r1', 'fixture-check', '2026-09-18', 'check', 0, NULL, '2026-09-18T00:00:00.000Z', '2026-09-18T00:00:00.000Z'), ('fixture-r2', 'fixture-number', '2026-09-18', 'number', NULL, 1000000000000, '2026-09-18T00:00:00.000Z', '2026-09-18T00:00:00.000Z');
