import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { logger } from "firebase-functions";
import { onDocumentWritten } from "firebase-functions/v2/firestore";

initializeApp();

type Submission = { ownerUid?: string; state?: string; isRush?: boolean };
type PushSettings = { pushNotificationScope?: "all" | "rush" };
type PushDevice = { token?: string };
// 與 muingmanager 的 Firestore asia-east1 同區，避免跨區事件傳遞。
const functionRegion = "asia-east1";

export const notifySubmissionChange = onDocumentWritten(
  { document: "clientSubmissions/{submissionId}", region: functionRegion },
  async (event) => {
    const before = event.data?.before.data() as Submission | undefined;
    const submission = event.data?.after.data() as Submission | undefined;
    const ownerUid = submission?.ownerUid ?? before?.ownerUid;
    if (!ownerUid) return;

    const db = getFirestore();
    const settings = (await db.doc(`artists/${ownerUid}/settings/studio`).get()).data() as PushSettings | undefined;
    const pendingCount = (await db.collection("clientSubmissions").where("ownerUid", "==", ownerUid).where("state", "==", "submitted").count().get()).data().count;

    const devices = await db.collection(`artists/${ownerUid}/notificationDevices`).get();
    const targets = devices.docs.map((item) => ({ id: item.id, token: (item.data() as PushDevice).token })).filter((item): item is { id: string; token: string } => Boolean(item.token));
    if (!targets.length) return;

    const isNewIntake = !before && Boolean(submission && submission.state === "submitted");
    const shouldDisplay = isNewIntake && (settings?.pushNotificationScope !== "rush" || Boolean(submission?.isRush));

    const response = await getMessaging().sendEachForMulticast({
      tokens: targets.map((item) => item.token),
      data: { type: shouldDisplay ? "new-intake" : "badge-update", pendingIntakeCount: String(pendingCount) },
      webpush: { headers: { Urgency: submission?.isRush ? "high" : "normal" } },
    });
    const invalid = targets.filter((_, index) => !response.responses[index]?.success && ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(response.responses[index]?.error?.code ?? ""));
    await Promise.all(invalid.map((item) => db.doc(`artists/${ownerUid}/notificationDevices/${item.id}`).delete()));
    logger.info("Intake push processed", { submissionId: event.params.submissionId, sent: response.successCount, removedInvalidDevices: invalid.length, pendingCount, shouldDisplay, isRush: Boolean(submission?.isRush) });
  },
);
