import {
  buildSkillsCatalog,
  loadSkillManifests,
} from "../../../src/skills/manifests.js";

export async function buildSkillCatalogAndManifests(rootDir: string) {
  const manifests = await loadSkillManifests(rootDir);
  return {
    manifests,
    catalog: buildSkillsCatalog(manifests),
  };
}
