<?php
/**
 * What a visitor's page gets: the same thing a pasted Pinglide snippet is.
 *
 * Pinglide's embed boots one map per `script[data-snapshot]` on the page and
 * inserts the map right after that tag. The bundle itself is enqueued once, as a
 * module (it has to be one — its map library ships as ES modules only), and each
 * map is a `type="text/plain"` tag carrying only data, so it never executes and
 * WordPress's script queue stays the one place JavaScript comes from.
 *
 * **Nothing here talks to Pinglide.** The page loads the bundle and the map's
 * published snapshot from Pinglide's CDN, both static files. No API call, no
 * key, nothing per visitor.
 *
 * @package Pinglide
 */

defined( 'ABSPATH' ) || exit;

final class Pinglide_Embed {

	const DEFAULT_HEIGHT = 520;
	const MIN_HEIGHT     = 240;
	const MAX_HEIGHT     = 1200;

	/**
	 * @param string $slot   The block's or shortcode's slot id.
	 * @param int    $height Map height in pixels.
	 * @return string Safe HTML, or '' when there is nothing to show this visitor.
	 */
	public static function render( $slot, $height ): string {
		$map = Pinglide_Slots::get( $slot );

		if ( ! $map ) {
			// An empty box on a live page reads as a broken site, so visitors get
			// nothing. Whoever can fix it gets a note saying how.
			if ( ! current_user_can( 'edit_posts' ) ) {
				return '';
			}

			return '<p class="pinglide-notice" style="padding:1em;border:1px dashed currentColor;opacity:.7">'
				. esc_html__( "This Pinglide map isn't set up yet. Edit this page and press Set up this map. Only people who can edit the site see this note.", 'pinglide' )
				. '</p>';
		}

		self::enqueue( $map['script'] );

		return sprintf(
			'<script type="text/plain" data-snapshot="%s" data-height="%d"></script>',
			esc_url( $map['snapshot'] ),
			self::clamp_height( $height )
		);
	}

	/**
	 * @param mixed $height Requested height.
	 */
	public static function clamp_height( $height ): int {
		$height = (int) $height;

		if ( $height <= 0 ) {
			return self::DEFAULT_HEIGHT;
		}

		return max( self::MIN_HEIGHT, min( self::MAX_HEIGHT, $height ) );
	}

	/**
	 * Once per page, whatever the number of maps on it.
	 *
	 * **The version is null on purpose** — WordPress's "no version" value. Left
	 * alone it appends `?ver=<WordPress version>`, which says nothing about the
	 * bundle (that is versioned by its own `/embed/v1/` path) and gives every
	 * site a different URL for the same file. A module is identified by its full
	 * URL, so a query string is also the one way to make the browser load it
	 * twice — the embed is built not to care, and there is no reason to test that.
	 *
	 * @param string $script The bundle URL the connection stored.
	 */
	private static function enqueue( $script ): void {
		$src = $script ? $script : PINGLIDE_EMBED_URL;

		wp_enqueue_script_module( 'pinglide-embed', esc_url_raw( $src ), array(), null );
	}
}
