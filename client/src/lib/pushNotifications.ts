export type PushNotificationScope = "all" | "rush";

export function shouldNotifyForSubmission(scope: PushNotificationScope, isRush: boolean) {
  return scope === "all" || isRush;
}

export function describePushScope(scope: PushNotificationScope) {
  return scope === "all" ? "全部新墨諾函箋" : "僅加急墨諾函箋";
}

export function getWorkspaceIntakeUrl(origin: string, baseUrl: string) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(`${normalizedBase}?view=intake`, origin).toString();
}
