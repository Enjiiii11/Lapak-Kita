/*
# Admin moderation: admin list and admin delete on any product

1. New Tables
- `app_admins`: one row per administrator (user id). Rows are added by the project owner in the database, never by the app.

2. Security
- Row level security is enabled on `app_admins`.
- Signed-in users can only read their own row, so the app can tell whether they are an admin.
- No client can insert, update, or delete rows in `app_admins`.
- `products`: admins get an additional DELETE policy that lets them remove any listing. Sellers keep their existing rights to manage only their own listings.

3. Notes
- Re-running this migration is safe: all statements are idempotent.
- To make someone an admin, insert their user id into `app_admins` from the database SQL editor.
*/

CREATE TABLE IF NOT EXISTS app_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_admins ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON app_admins TO authenticated;

DROP POLICY IF EXISTS "select_own_admin_row" ON app_admins;
CREATE POLICY "select_own_admin_row" ON app_admins FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_delete_any_product" ON products;
CREATE POLICY "admin_delete_any_product" ON products FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM app_admins
      WHERE app_admins.user_id = auth.uid()
    )
  );
