import { ArtworkItem, createArtworkItem, getAvailableFinishes, getAvailableQSizes, getAvailableScopes } from "@/lib/commission";
import { StudioSettings } from "@/lib/studioSettings";

export function getPublicArtworkOptions(settings: StudioSettings, scope?: ArtworkItem["artScope"]) {
  const scopes = getAvailableScopes(settings) as ArtworkItem["artScope"][];
  const resolvedScope = scope && scopes.includes(scope) ? scope : scopes[0];
  return {
    scopes,
    scope: resolvedScope,
    finishes: resolvedScope && resolvedScope !== "Q版" ? getAvailableFinishes(settings, resolvedScope) : [],
    qSizes: resolvedScope === "Q版" ? getAvailableQSizes(settings) : [],
  };
}

export function normalizePublicArtworkItem(settings: StudioSettings, current?: ArtworkItem): ArtworkItem | null {
  const options = getPublicArtworkOptions(settings, current?.artScope);
  if (!options.scope) return null;
  if (options.scope === "Q版") {
    const qSize = current?.qSize && options.qSizes.includes(current.qSize) ? current.qSize : options.qSizes[0];
    if (!qSize) return null;
    return createArtworkItem({ ...current, artScope: options.scope, qSize, finishLevel: current?.finishLevel ?? "一般" });
  }
  const finishLevel = current?.finishLevel && options.finishes.includes(current.finishLevel) ? current.finishLevel : options.finishes[0];
  if (!finishLevel) return null;
  return createArtworkItem({ ...current, artScope: options.scope, finishLevel, qSize: null });
}
