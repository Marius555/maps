/**
 * Whether a beacon came from an owner looking at their own map in a site
 * editor, rather than from a visitor.
 *
 * The WordPress plugin's live preview is a page under `/wp-admin/`
 * (`distribution/wordpress/pinglide/includes/class-pinglide-preview.php`), in
 * the block editor and in Elementor alike. Nothing a visitor can open lives
 * there, so a session from that path is the owner previewing their own map, and
 * counting it would fill their Analytics tab — and their monthly session
 * ceiling — with themselves.
 *
 * Matched anywhere in the path, because WordPress installed in a subfolder
 * serves wp-admin from `/blog/wp-admin/`. A string test on what the beacon
 * already carries, so it costs the embed nothing.
 */
export function isEditorPreview(path: string): boolean {
  return path.toLowerCase().includes("/wp-admin/");
}
