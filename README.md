# 繪月錄

供個人接案繪師使用的離線優先委託管理 PWA。應用程式以 Firebase Authentication 與 Firestore 保存資料，並可部署至 GitHub Pages。

## 本機使用

請先使用 Node.js 22 與 pnpm 10，接著執行：

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

開發時可執行 `pnpm dev`。正式靜態輸出會產生於 `dist/`，該目錄不應提交至 Git。

## GitHub Pages 部署

部署工作流程位於 `.github/workflows/deploy-pages.yml`。請在 GitHub 儲存庫的 **Settings → Secrets and variables → Actions** 設定以下 Actions secrets：

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_ALLOWED_UID`

推送至 `main` 分支後，工作流程會執行型別檢查、單元測試、PWA 建置並發布到 GitHub Pages。Firebase 規則與部署細節請參閱 [`docs/Firebase與GitHub部署手冊.md`](docs/Firebase與GitHub部署手冊.md)。

委託人公開填單與個人案件進度入口的 Firebase 啟用步驟，請參閱 [`docs/委託人入口啟用指南.md`](docs/委託人入口啟用指南.md)。

> 請勿提交 `.env`、`.project-config.json`、`dist/`、`node_modules/` 或任何 Firebase 私密設定檔。
