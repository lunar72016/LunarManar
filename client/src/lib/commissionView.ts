import { Commission, describeArtworkItems } from "@/lib/commission";

export function getViewRequirementRows(commission: Commission) {
  if (commission.artworkItems?.length) {
    return commission.artworkItems.map((item, index) => ({
      id: item.id,
      ordinal: index + 1,
      summary: `${item.characterCount} 人 · ${item.artScope}${item.artScope === "Q版" && item.qSize ? `（${item.qSize}）` : ""} · ${item.finishLevel}`,
      note: item.note,
    }));
  }
  return [{ id: "legacy-summary", ordinal: 1, summary: describeArtworkItems(commission), note: "" }];
}

export function switchFromViewToEditor(commission: Commission, closeView: () => void, openEditor: (commission: Commission) => void) {
  closeView();
  openEditor(commission);
}
