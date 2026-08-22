# Safari 與 Firebase 認證架構研究紀錄

## 2026-08-22：Apple 登入可行性

Firebase 的「透過 Apple 登錄」網頁流程仍使用 Firebase Authentication 的彈出式或導向式 OAuth 機制。Firebase 官方要求導向式登入在阻擋第三方儲存的瀏覽器中，必須採取相同網域的 `authDomain`、反向代理、自行處理供應商登入等其中一種架構作法；因此，僅新增 Apple Provider 無法根除目前 GitHub Pages 網域與 `muingmanager.firebaseapp.com` 認證網域不同造成的 Safari 限制。

Apple 登入還需要 Apple Developer Program、Service ID、私鑰與 Team ID 的額外設定。若以 Firebase SDK 導向流程實作，官方同樣要求遵循導向登入最佳實務。官方文件也指出，自行代管 Firebase 登入協助程式的方式不適用於 Apple 登入；若日後要兼顧 Safari 與 Apple 登入，較適合的根本方案是改用自有網域及可支援反向代理／認證協助路由的主機，或獨立處理供應商登入再交換 Firebase 憑證。

## 參考來源

- Firebase：<https://firebase.google.com/docs/auth/web/redirect-best-practices>
- Firebase：<https://firebase.google.com/docs/auth/web/apple>
- Apple：<https://support.apple.com/guide/safari/prevent-cross-site-tracking-sfri40732/mac>
