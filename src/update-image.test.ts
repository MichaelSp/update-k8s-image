import { updateImage } from "./update-image";

describe("update-image", () => {
  test("empty manifest errors", () => {
    expect(() => updateImage("", "", "")).toThrow("No valid manifest found.");
  });

  test("malformed definition errors", () => {
    const malformedFile = `
spec:
  template2:
    spec:
      containers:
        - name: nginx
          image: nginx:1.14.2
`;

    expect(updateImage(malformedFile, "", "")[0]?.error?.message).toEqual(
      "Containers definition is missing"
    );
  });

  test("errors when multiple images match name ", () => {
    const multipleMatch = `
spec:
  template:
    spec:
      containers:
        - name: nginx
          image: nginx:1.14.2
        - name: nginx
          image: nginx:1.14.2
`;

    expect(updateImage(multipleMatch, "nginx", "")[0]?.error?.message).toEqual(
      'Expected 1 image with name "nginx" but found 2'
    );
  });

  function nginxSpec(version: string): string {
    return `spec:
  template:
    spec:
      containers:
        - name: nginx
          image: nginx:${version}
        - name: sidecar
          image: istio:1.0
`;
  }

  test("updates image version", () => {
    const manifest = nginxSpec("1.0");
    expect(updateImage(manifest, "nginx", "2.0")[0].toString()).toEqual(
      nginxSpec("2.0")
    );
  });

  test("returns previous tag", () => {
    const manifest = nginxSpec("1.0");
    expect(updateImage(manifest, "nginx", "2.0")[0].oldTag).toEqual("1.0");
  });

  describe("multi-doc", () => {
    test("simple multi doc", () => {
      const manifests = `
---
spec:
  template:
    spec:
      containers:
        - name: nginx
          image: nginx:1.0
---
spec:
  template:
    spec:
      containers:
        - name: nginx
          image: nginx:1.1
`;
      expect(
        updateImage(manifests, "nginx", "2.0").map((r) => r.oldTag)
      ).toEqual(["1.0", "1.1"]);
    });

    test("multi doc with missing image", () => {
      const manifests = `---
spec:
  template:
    spec:
      containers:
        - name: nginx
          image: nginx:1.0
---
# comment
spec:
  some:
    other:
    - resource #with a comment
    - type
---
spec:
  template:
    spec:
      containers:
        - name: nginx
          image: nginx:1.1
`;
      const results = updateImage(manifests, "nginx", "2.0");
      expect(results.map((r) => r.oldTag)).toEqual(["1.0", undefined, "1.1"]);
      expect(results[1].error).toEqual(
        new Error("Containers definition is missing")
      );
      expect(results.map((r) => r.toString()).join("")).toEqual(`---
spec:
  template:
    spec:
      containers:
        - name: nginx
          image: nginx:2.0
---
# comment
spec:
  some:
    other:
      - resource #with a comment
      - type
---
spec:
  template:
    spec:
      containers:
        - name: nginx
          image: nginx:2.0
`);
    });

    test("multi doc with different container names", () => {
      const manifests = `
---
spec:
  template:
    spec:
      containers:
        - name: nginx
          image: nginx:1.0
---
spec:
  template:
    spec:
      containers:
        - name: alpine
          image: alpine:1.1
`;
      const results = updateImage(manifests, "nginx", "2.0");
      expect(results.map((r) => r.oldTag)).toEqual(["1.0", undefined]);
      expect(results.map((r) => r.error)).toEqual([
        undefined,
        new Error('Expected 1 image with name "nginx" but found 0'),
      ]);
    });
  });
});
