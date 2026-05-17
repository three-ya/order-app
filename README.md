# 訂位管理系統 — 部署說明

## 需要的帳號（都免費）
- GitHub: https://github.com
- Supabase: https://supabase.com（Region 選 Southeast Asia Singapore）
- Vercel: https://vercel.com（用 GitHub 帳號登入）

---

## 步驟一：建立資料庫（Supabase）

1. 登入 Supabase → 建立新專案（設定一組資料庫密碼，自己記住）
2. 左側選單 → SQL Editor
3. 把 `setup.sql` 的全部內容貼上 → 點 Run
4. 左側 → Project Settings → API，複製：
   - Project URL（貼到 .env.local 的 SUPABASE_URL）
   - anon/public key（貼到 .env.local 的 SUPABASE_ANON_KEY）

## 步驟二：建立使用者帳號

1. Supabase → Authentication → Users → Invite user
2. 輸入你和櫃台的 Email，系統會寄邀請信
3. 點信裡的連結設定密碼
4. 如果要改名字：SQL Editor 執行：
   ```sql
   update profiles set name = '你的名字', role = 'owner'
   where id = '你的使用者ID';
   ```

## 步驟三：上傳程式碼（GitHub）

1. 登入 GitHub → New repository → 命名（例如 order-app）→ 建立
2. 在電腦上，把這個資料夾裡的所有檔案上傳到那個 repository
   （如果不熟 Git，可以直接在 GitHub 網頁用「Upload files」）

## 步驟四：部署（Vercel）

1. 登入 Vercel → Add New Project → 選剛才的 GitHub repo
2. Framework Preset 選 Next.js（通常自動偵測）
3. Environment Variables 新增兩個：
   - `NEXT_PUBLIC_SUPABASE_URL` = 你的 Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = 你的 anon key
4. 點 Deploy，等約 1 分鐘
5. 部署完成後 Vercel 會給你一個網址（例如 order-app.vercel.app）

---

## 日常使用

- 打開網址 → 用 Email + 密碼登入
- 上方左右箭頭切換日期
- 圓圈點一下 = 確認/取消確認
- 每次有人修改，其他人重新整理就會看到最新資料（支援即時同步）
- 匯出 CSV → Excel 直接開啟，中文不會亂碼

---

## 常見問題

**登入後跳回登入頁？**
→ 確認 Supabase URL 和 anon key 有沒有貼正確

**資料不見了？**
→ 確認 SQL Editor 有跑完 setup.sql

**要新增使用者？**
→ Supabase → Authentication → Users → Invite user
