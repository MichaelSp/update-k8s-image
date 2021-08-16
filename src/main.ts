import { updateImage, UpdateResult } from "./update-image";
import * as core from "@actions/core";
import * as fs from "fs";

function inputs(): string[] {
  return [
    "manifest-path",
    "new-image-tag",
    "container-name",
    "multi-doc-error",
  ].map((inputName) => core.getInput(inputName, { required: true }));
}

try {
  const [manifestPath, newTag, containerName, multiDocError] = inputs();
  const results: UpdateResult[] = updateImage(
    fs.readFileSync(manifestPath, "utf-8"),
    containerName,
    newTag
  );
  if (multiDocError === "fail" && results.find((result) => result.error)) {
    core.setFailed(new Error(""));
  } else {
    if (results.length == 1) {
      core.setOutput(`old-image-tag`, results[0].oldTag);
    }
    results.forEach((result) => {
      if (result.error && multiDocError !== "ignore") {
        core.warning(result.error?.message);
      }
      core.setOutput(`old-image-tag-${result.imageName}`, result.oldTag);
    });
    fs.writeFileSync(manifestPath, results.map(r=> r.toString()).join(""));
  }
} catch (error) {
  core.setFailed(error.message);
}
