<?php
/**
 * The live map an editor sees: a bare page holding one map, loaded in an iframe
 * by the block editor and by Elementor's editor.
 *
 * **Why a page of its own, on this site.** The block editor draws blocks inside
 * an iframe whose address is a `blob:` URL, and its hostname is empty, so a map
 * whose domain allowlist names this site would refuse to draw there. This page
 * is served from the site itself, so the allowlist passes exactly as it does
 * for a visitor. It is also the only way to keep the map alive in Elementor,
 * which re-renders a widget by swapping HTML in after the embed has booted.
 *
 * **Why under /wp-admin/.** It is admin-post.php, so only signed-in editors reach
 * it, and the path is one no visitor's page can have. Pinglide's analytics drops
 * sessions from it (`isEditorPreview` in the app), so an owner looking at their
 * own map in the editor is never counted as a visitor.
 *
 * It loads what a visitor's page loads — the bundle and the snapshot from the
 * CDN — and nothing else.
 *
 * @package Pinglide
 */

defined( 'ABSPATH' ) || exit;

final class Pinglide_Preview {

	const ACTION = 'pinglide_preview';

	public static function init(): void {
		add_action( 'admin_post_' . self::ACTION, array( __CLASS__, 'render' ) );
	}

	public static function render(): void {
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_die( esc_html__( "You don't have permission to preview maps on this site.", 'pinglide' ), 403 );
		}

		// phpcs:disable WordPress.Security.NonceVerification.Recommended -- read-only, and only for editors.
		$slot = isset( $_GET['slot'] ) ? sanitize_text_field( wp_unslash( $_GET['slot'] ) ) : '';
		$tags = isset( $_GET['tags'] ) ? sanitize_text_field( wp_unslash( $_GET['tags'] ) ) : '';
		// phpcs:enable

		nocache_headers();

		// Sized by the frame around it, never by itself: the editor sets the height.
		$html = Pinglide_Embed::render( $slot, array( 'tags' => $tags, 'eager' => true ), '', false );

		?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title><?php esc_html_e( 'Pinglide map preview', 'pinglide' ); ?></title>
<style>
html,body{margin:0;height:100%;font-family:system-ui,sans-serif}
.wp-block-pinglide-map,.pinglide-map__canvas{height:100%!important}
.pinglide-notice{margin:1em}
</style>
</head>
<body>
		<?php
		echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped in Pinglide_Embed::render().
		wp_script_modules()->print_enqueued_script_modules();
		?>
</body>
</html>
		<?php
		exit;
	}
}
