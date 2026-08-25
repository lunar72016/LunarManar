# 繪月錄新函件背景推播函式

此目錄是 **Firebase Cloud Functions** 的獨立部署單位，不會被 GitHub Pages 的前端建置上傳或執行。函式部署於 `asia-east1`，與 Firestore 資料庫同區。

## 推播規則

每當 `clientSubmissions` 建立、受理或刪除時，函式都會更新已授權裝置的待啟墨函紅點。建立一筆仍為 `submitted` 的新墨諾函箋時，函式會讀取 `artists/{繪師 UID}/settings/studio` 的 `pushNotificationScope` 決定是否額外顯示系統通知。

| 設定 | 行為 |
|---|---|
| `all` | 對已授權的繪師裝置通知每一封新墨諾函箋；此為一個月成本測試預設值。 |
| `rush` | 僅在函件的 `isRush` 為 `true` 時通知。 |

訊息不包含寄墨主姓名、聯絡方式、委託內容或金額；通知文字固定為「有新的墨諾函箋待啟讀」。若 FCM 回覆裝置權杖失效，函式會刪除該裝置紀錄。

## 一次性部署

請先在本機安裝 [Firebase CLI](https://firebase.google.com/docs/cli)，並以擁有 `muingmanager` 專案權限的 Google 帳號登入。從專案根目錄執行：

```bash
npm install -g firebase-tools
firebase login
npm --prefix functions install
firebase use muingmanager
firebase deploy --only functions:push,firestore:rules
```

部署後，在繪師登入的「丹青設案 → 新墨諾函箋通知」中按「開啟這台裝置通知」，允許瀏覽器通知權限。首次請用 Firebase Console 的 Messaging「Send test message」測試該裝置，之後再以懸榜昭繪送出測試函件。

> 變更 Firestore 規則前，請確認最新 `firestore.rules` 已包含 `notificationDevices` 存取規則；只有指定繪師 UID 能讀寫自己的裝置權杖。
