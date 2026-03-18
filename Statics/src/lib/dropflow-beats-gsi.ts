/**
 * GSI keys for dropflow_beats (see scripts/add-dropflow-beats-gsi.sh).
 * - catalog-by-date: all beats ordered by upload time
 * - creator-by-date: beats per creator ordered by upload time
 */
export const DROPFLOW_BEAT_CATALOG_PK = "DROPFLOW_BEAT_CATALOG";

export function beatCatalogSortKey(createdAt: string, beatId: string): string {
  return `${createdAt}#${beatId}`;
}

export function beatGsiAttributes(createdAt: string, beatId: string, creatorUsername: string) {
  const sk = beatCatalogSortKey(createdAt, beatId);
  return {
    gpkCatalog: DROPFLOW_BEAT_CATALOG_PK,
    gskCatalog: sk,
    gskCreator: sk,
  };
}
