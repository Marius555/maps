import { describe, expect, it } from "vitest";

import { isEditorPreview } from "./editor-preview";

/** The WordPress plugin's preview page must never count as a visit. */
describe("isEditorPreview", () => {
  it("drops the plugin's preview page", () => {
    expect(isEditorPreview("/wp-admin/admin-post.php")).toBe(true);
  });

  it("drops it when WordPress lives in a subfolder", () => {
    expect(isEditorPreview("/blog/wp-admin/admin-post.php")).toBe(true);
    expect(isEditorPreview("/Blog/WP-Admin/admin-post.php")).toBe(true);
  });

  it("keeps every page a visitor can open", () => {
    expect(isEditorPreview("/")).toBe(false);
    expect(isEditorPreview("/stores/")).toBe(false);
    expect(isEditorPreview("/wp-administrators-guide/")).toBe(false);
    expect(isEditorPreview("")).toBe(false);
  });
});
