import type { DigitalResource, KnowledgeRegistry } from "../../lib/knowledge-types";
import { getMediaControls, validateIiifManifest } from "../../lib/knowledge-domain";
import { approvedIiifResource } from "../../lib/knowledge-reading";
import { IiifCanvasViewer } from "./knowledge-iiif-viewer";

export function IiifResourcePresentation({ resource, registry }: { resource: DigitalResource; registry: KnowledgeRegistry }) {
  if (!approvedIiifResource(resource, registry) || !resource.iiifManifestJson) return null;
  const rights = registry.rights.find(item => item.id === resource.rightsId);
  if (!rights) return null;
  const preview = validateIiifManifest(resource.iiifManifestJson);
  if (preview.id !== resource.iiifManifest) return null;
  const controls = getMediaControls(rights);
  return <IiifCanvasViewer preview={preview} download={controls.download} attribution={rights.attribution} />;
}
