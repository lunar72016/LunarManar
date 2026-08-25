export type BadgeCapableNavigator = {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

/** 將待啟墨函數量同步至已安裝 PWA 的圖標紅點；不支援的瀏覽器會安靜略過。 */
export async function syncPwaBadge(navigatorLike: BadgeCapableNavigator, pendingCount: number) {
  try {
    if (pendingCount > 0 && navigatorLike.setAppBadge) {
      await navigatorLike.setAppBadge(pendingCount);
      return;
    }
    if (pendingCount <= 0 && navigatorLike.clearAppBadge) await navigatorLike.clearAppBadge();
  } catch {
    // 裝置或瀏覽器拒絕 badge 時仍保留側欄即時數量，不中斷工作台。
  }
}
