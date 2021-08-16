import * as Yaml from "yaml";

export interface UpdateResult extends Yaml.Document.Parsed {
  oldTag?: string;
  error?: Error;
  imageName?: string;
}

type ContainerType = Yaml.YAMLMap<string, unknown>;
type ContainerListType = undefined | Yaml.Node;

function findContainer(
  manifest: Yaml.Document.Parsed,
  containerName: string
): ContainerType {
  const images: ContainerListType = manifest?.getIn([
    "spec",
    "template",
    "spec",
    "containers",
  ]) as ContainerListType;
  if (images === undefined) {
    throw new Error("Containers definition is missing");
  }
  if (!Yaml.isCollection(images) || images.items.length == 0) {
    throw new Error("Incorrect container definition");
  }
  const img: Yaml.YAMLSeq<ContainerType> =
    images as Yaml.YAMLSeq<ContainerType>;
  const matches = img.items.filter(
    (imageSpec: ContainerType) => imageSpec.get("name") === containerName
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected 1 image with name "${containerName}" but found ${matches.length}`
    );
  }
  return matches[0];
}

export function updateImage(
  manifestContent: string,
  containerName: string,
  newTag: string
): UpdateResult[] {
  const manifests: UpdateResult[] = Yaml.parseAllDocuments(manifestContent);
  if (manifests.length == 0) {
    throw new Error("No valid manifest found.");
  }
  manifests.map((manifest) => {
    try {
      const targetContainer = findContainer(manifest, containerName);
      const image = targetContainer.get("image");
      if (typeof image !== "string") {
        manifest.error = new Error(
          `Image of container '${containerName}' is not a string.`
        );
      } else {
        const [imageName, oldTag] = image.split(":");
        targetContainer.set("image", [imageName, newTag].join(":"));
        manifest.imageName = imageName;
        manifest.oldTag = oldTag;
      }
    } catch (error) {
      manifest.error = error;
    }
  });
  return manifests;
}
