import type { Commission } from "@/lib/commission";
import type { ClientProgress, ClientSubmission } from "@/lib/clientPortal";
import type { StudioSettings } from "@/lib/studioSettings";

export type WorkspaceBackup = {
  format: "hui-yue-ledger-backup";
  version: 1;
  exportedAt: string;
  studioSettings: StudioSettings;
  commissions: Commission[];
  clientSubmissions: ClientSubmission[];
  clientProgress: ClientProgress[];
};

export function createWorkspaceBackup(input: Omit<WorkspaceBackup, "format" | "version" | "exportedAt">, exportedAt = new Date().toISOString()): WorkspaceBackup {
  return { format: "hui-yue-ledger-backup", version: 1, exportedAt, ...input };
}

export function workspaceBackupFilename(exportedAt: string) {
  const date = new Date(exportedAt);
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}-${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}`;
  return `繪月錄-本機備份-${stamp}.json`;
}

export function downloadWorkspaceBackup(backup: WorkspaceBackup) {
  const content = JSON.stringify(backup, null, 2);
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = workspaceBackupFilename(backup.exportedAt);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
