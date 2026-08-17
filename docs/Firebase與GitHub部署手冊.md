# Firebase 與 GitHub Pages 部署手冊

本專案是**純靜態 Progressive Web App（PWA）**。正式版本由 GitHub Pages 提供前端檔案，登入和資料同步則直接使用 Firebase Authentication 與 Cloud Firestore。Cloud Firestore 的網頁持久化快取可在離線時讀寫已快取資料，恢復連線後由 SDK 自動將本機變更同步到雲端。[1]

> 管理介面中的 UID 檢查用於前端使用體驗；真正的資料保護必須套用 `firestore.rules`。在啟用離線快取的私人委託資料前，請只在受信任的個人裝置上使用。[1]

## 一、Firebase Console 初始設定

| 設定位置 | 必須完成的動作 | 本專案用途 |
| --- | --- | --- |
| **Authentication → Sign-in method** | 啟用「電子郵件／密碼」登入。 | 提供繪師專用登入。Firebase 的網頁版支援以電子郵件與密碼登入。[2] |
| **Authentication → Users** | 建立你的繪師帳號，並確認其 UID 為 `a9dFKJad7HUkHnZaNmF1cUTfZ583`。 | 此 UID 是前端白名單與 Firestore Rules 的唯一管理者。 |
| **Firestore Database** | 以 Production mode 建立 Cloud Firestore。 | 儲存委託、款項、草稿與進度歷程。 |
| **Firestore Database → Rules** | 以本專案根目錄的 `firestore.rules` 完整覆蓋規則後發布。 | 僅允許指定 UID 對 `artists/{uid}/commissions/*` 讀寫。 |
| **Authentication → Settings → Authorized domains** | 加入 `你的帳號.github.io`；若有自訂網域也一併加入。 | 讓部署後的 Firebase Authentication 可正常登入。 |

Firestore Rules 發布完成後，未登入者、UID 不相符者，以及試圖存取其他 `artistId` 資料路徑者都會被拒絕。不要為了排錯暫時改成 `allow read, write: if true;`，這會公開所有委託資料。

## 二、建立 GitHub 儲存庫與 Secrets

請將專案上傳至新的 GitHub 儲存庫，並在 **Settings → Secrets and variables → Actions** 建立下列 Repository secrets。這些值與目前開發環境相同；即使 Firebase Web 組態中的 API Key 會出現在建置後的瀏覽器端程式碼，也不應把管理者 UID 或其他設定直接硬寫在原始碼中，且安全性仍必須由 Firestore Rules 強制執行。

| Secret 名稱 | 來源 |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | Firebase Web App 組態的 `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Web App 組態的 `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Web App 組態的 `projectId` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Web App 組態的 `storageBucket` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Web App 組態的 `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | Firebase Web App 組態的 `appId` |
| `VITE_FIREBASE_ALLOWED_UID` | `a9dFKJad7HUkHnZaNmF1cUTfZ583` |

## 三、啟用 GitHub Pages 自動部署

專案已附上 `.github/workflows/deploy-pages.yml`。推送至 `main` 分支後，工作流程會依序安裝套件、執行 TypeScript 檢查與單元測試，再建置 `dist` 並交由 GitHub Pages 發布。

| 儲存庫類型 | GitHub Pages 設定 | 最終網址範例 |
| --- | --- | --- |
| 一般儲存庫，例如 `commission-manager` | **Settings → Pages → Build and deployment → Source：GitHub Actions**。 | `https://帳號.github.io/commission-manager/` |
| 個人／組織根網站儲存庫，例如 `帳號.github.io` | 設定相同。 | `https://帳號.github.io/` |

Vite 設定會在 GitHub Actions 執行時自動辨識上述兩種網址路徑，因此不需要手動改動 `base`。GitHub Pages 的 Actions 發布流程會將靜態建置成品上傳並部署；Firebase Hosting 也可作為日後替代方案，但目前專案不依賴它。[3]

## 四、首次使用與離線驗證

部署完成後，先用 Firebase Authentication 的繪師帳號登入。畫面空白時可按下「匯入既有委託紀錄」，一次寫入八月 8 筆與九月 6 筆資料；系統不會自動猜測歷史付款或草稿狀態，請再逐筆補登。若你還未建立 Firestore Database，請先按「建立資料庫」、選擇 Production mode，再到 Rules 分頁發布 `firestore.rules`；否則畫面會顯示明確的 Firestore 存取錯誤提示。

接著請以手機瀏覽器開啟網站，使用瀏覽器選單的「加入主畫面」或「安裝應用程式」。進入工作台後，建立或編輯一張委託單，再暫時關閉網路確認畫面上顯示「離線快取」且可繼續編輯；重新連線後應改回「同步中」再顯示「已同步」。Cloud Firestore 網頁端持久化快取支援讀取、查詢與將寫入操作排隊，網路恢復時會自動同步。[1]

編輯既有委託單時，視窗左下角會顯示「刪除此排單」。按下後系統會再次要求確認，確認刪除才會從工作台與 Firestore 移除該筆資料。刪除先套用至本機快取並在背景同步；若 Firebase 規則或網路阻擋寫入，畫面會顯示錯誤訊息，方便先排除設定問題。

## 五、限時進度分享的後續擴充

每張委託單已預留 `shareEnabled`、`shareTokenHash` 與 `shareExpiresAt` 欄位，並包含 `/progress/:token` 安全占位頁。此頁目前刻意不讀取任何委託資料，因為**純靜態前端不適合驗證權杖並安全投影局部資料**。正式啟用時應新增受保護的後端函式，驗證雜湊權杖與有效期限後，只回傳委託人可見的狀態、排單月份與下一步提示；不可回傳聯絡方式、設定圖、價格、付款或內部備註。

## 六、本機驗證指令

| 指令 | 驗證內容 |
| --- | --- |
| `pnpm check` | TypeScript 型別、PWA 虛擬模組與 Firebase 整合是否可編譯。 |
| `pnpm test` | Firebase API Key 可辨識、初始 14 筆資料、價格格式與狀態模型。 |
| `pnpm build` | 產出 GitHub Pages 使用的 `dist` 靜態檔與 Service Worker。 |

## 參考資料

[1] [Firebase：Cloud Firestore 離線資料存取](https://firebase.google.com/docs/firestore/manage-data/enable-offline)

[2] [Firebase：電子郵件／密碼登入](https://firebase.google.com/docs/auth/web/password-auth)

[3] [Firebase：靜態網站與 PWA 部署概覽](https://firebase.google.com/docs/hosting)
