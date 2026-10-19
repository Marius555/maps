<?php
/**
 * What a visitor's page gets: the same thing a pasted Pinglide snippet is.
 *
 * Pinglide's embed boots one map per `script[data-snapshot]` on the page. The
 * bundle itself is enqueued once, as a module (it has to be one — its map
 * library ships as ES modules only), and each map is a `type="text/plain"` tag
 * carrying only data, so it never executes and WordPress's script queue stays
 * the one place JavaScript comes from.
 *
 * **Sizing needs no embed change.** The tag names its canvas with `data-target`,
 * and the embed gives a target an inline `height` from `data-height`. A style
 * rule printed beside it, scoped to this one map's id and marked `!important`,
 * outranks that inline height — which is how a map is one height on computers
 * and another on phones while the embed only knows one number.
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
	const MIN_WIDTH      = 20;

	/** Below this the map is full width and takes its phone height. WordPress's own mobile breakpoint. */
	const PHONE_MAX_WIDTH = 600;

	const ALIGNS = array( 'left', 'center', 'right', 'wide', 'full' );

	/** Makes every map's id unique on its page, even when one slot is placed twice. */
	private static $count = 0;

	/**
	 * Every way in (block, shortcode, preview, Elementor) is normalised here, so
	 * a value nobody checked can never reach the page.
	 *
	 * @param array $raw { height, mobile_height, width, align, tags, eager }, any of them missing.
	 * @return array The same keys, clamped. Missing means what 0.1.0 did.
	 */
	public static function options( array $raw ): array {
		$mobile = isset( $raw['mobile_height'] ) ? (int) $raw['mobile_height'] : 0;
		$width  = isset( $raw['width'] ) ? (int) $raw['width'] : 100;
		$align  = isset( $raw['align'] ) ? (string) $raw['align'] : '';
		$tags   = isset( $raw['tags'] ) ? $raw['tags'] : array();

		if ( is_string( $tags ) ) {
			$tags = explode( ',', $tags );
		}

		return array(
			'height'        => self::clamp_height( isset( $raw['height'] ) ? $raw['height'] : self::DEFAULT_HEIGHT ),
			// 0 is "the same as on computers", and so is anything nonsensical.
			'mobile_height' => $mobile > 0 ? self::clamp_height( $mobile ) : 0,
			'width'         => $width > 0 ? max( self::MIN_WIDTH, min( 100, $width ) ) : 100,
			'align'         => in_array( $align, self::ALIGNS, true ) ? $align : '',
			'tags'          => self::clean_tags( is_array( $tags ) ? $tags : array() ),
			'eager'         => ! empty( $raw['eager'] ) && 'no' !== $raw['eager'] && 'false' !== $raw['eager'],
		);
	}

	/**
	 * @param string $slot          The block's or shortcode's slot id.
	 * @param array  $raw           Display options, see options().
	 * @param string $wrapper_attrs Already-escaped attributes for the outer element
	 *                              (a block's get_block_wrapper_attributes()); '' for none.
	 * @param bool   $own_size      False when someone else sizes the map (Elementor
	 *                              writes its own responsive CSS), so no rule is printed here.
	 * @return string Safe HTML, or '' when there is nothing to show this visitor.
	 */
	public static function render( $slot, array $raw = array(), string $wrapper_attrs = '', bool $own_size = true ): string {
		$map = Pinglide_Slots::get( $slot );

		if ( ! $map || ! Pinglide_Slots::is_allowed_url( $map['snapshot'] ) ) {
			return self::not_set_up();
		}

		$opts = self::options( $raw );
		$id   = 'pinglide-' . ( ++self::$count );

		self::enqueue( $map['script'] );

		$script = sprintf(
			'<script type="text/plain" data-snapshot="%s" data-target="#%s" data-height="%d"%s%s></script>',
			esc_url( $map['snapshot'] ),
			esc_attr( $id . '-canvas' ),
			$opts['height'],
			$opts['tags'] ? ' data-tags="' . esc_attr( implode( ',', $opts['tags'] ) ) . '"' : '',
			$opts['eager'] ? ' data-eager' : ''
		);

		return sprintf(
			'<div id="%1$s" %2$s>%3$s%4$s<div id="%1$s-canvas" class="pinglide-map__canvas"></div></div>',
			esc_attr( $id ),
			self::wrapper_attrs( $wrapper_attrs, $opts['align'] ),
			$own_size ? '<style>' . self::css( '#' . $id, $opts ) . '</style>' : '',
			$script
		);
	}

	/**
	 * The size rules for one map. Everything in it is an integer or an id this
	 * class minted, so it needs no escaping beyond what built it.
	 *
	 * **Twin:** `sizeCss()` in blocks/map/index.js draws the editor's preview
	 * from the same rules. Change one, change the other.
	 *
	 * @param string $sel  The wrapper's selector.
	 * @param array  $opts Normalised options.
	 */
	public static function css( string $sel, array $opts ): string {
		$canvas = $sel . ' .pinglide-map__canvas';
		$css    = $sel . '{overflow:hidden}';
		// Wide and full say how wide already; a percentage on top would fight them.
		$narrow = $opts['width'] < 100 && ! in_array( $opts['align'], array( 'wide', 'full' ), true );

		if ( $narrow ) {
			/*
			 * A percentage of the *text column*, not of whatever holds the block. A
			 * block theme floats left/right blocks against its full-width root, so a
			 * plain 60% would be 60% of the window and hang past the text. The
			 * theme's content width is a custom property; min() keeps a block inside
			 * a narrower column (a Columns block) at a share of that column instead.
			 * Classic themes have no such property and get plain percentages.
			 */
			$content = 'var(--wp--style--global--content-size,100%)';
			$css    .= $sel . '{width:min(' . $opts['width'] . '%,calc(' . $content . '*' . $opts['width'] . '/100));max-width:100%}';
			// Themes style the align classes, but not all of them do it for a div.
			$edge = 'max(0px,calc((100% - ' . $content . ')/2))';
			if ( 'center' === $opts['align'] ) {
				$css .= $sel . '{margin-left:auto!important;margin-right:auto!important}';
			} elseif ( 'left' === $opts['align'] ) {
				$css .= $sel . '{float:left;margin-left:' . $edge . '!important;margin-right:1.5em}';
			} elseif ( 'right' === $opts['align'] ) {
				$css .= $sel . '{float:right;margin-right:' . $edge . '!important;margin-left:1.5em}';
			}
		}

		$css .= $canvas . '{height:' . $opts['height'] . 'px!important}';

		$phone = '';
		if ( $narrow ) {
			$phone .= $sel . '{width:100%!important;float:none!important;margin-left:0!important;margin-right:0!important}';
		}
		if ( $opts['mobile_height'] > 0 ) {
			$phone .= $canvas . '{height:' . $opts['mobile_height'] . 'px!important}';
		}
		if ( '' !== $phone ) {
			$css .= '@media (max-width:' . self::PHONE_MAX_WIDTH . 'px){' . $phone . '}';
		}

		return $css;
	}

	/**
	 * The page an editor's live preview loads in an iframe — `class-pinglide-preview.php`.
	 *
	 * @param string $slot Slot id.
	 * @param array  $raw  Display options; only the ones that change the map itself travel.
	 */
	public static function preview_url( string $slot, array $raw = array() ): string {
		$opts = self::options( $raw );

		return add_query_arg(
			array_filter(
				array(
					'action' => Pinglide_Preview::ACTION,
					'slot'   => $slot,
					'tags'   => implode( ',', $opts['tags'] ),
				)
			),
			admin_url( 'admin-post.php' )
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
	 * An empty box on a live page reads as a broken site, so visitors get
	 * nothing. Whoever can fix it gets a note saying how.
	 */
	public static function not_set_up(): string {
		if ( ! current_user_can( 'edit_posts' ) ) {
			return '';
		}

		return '<p class="pinglide-notice" style="padding:1em;border:1px dashed currentColor;opacity:.7">'
			. esc_html__( "This Pinglide map isn't set up yet. Edit this page and press Set up this map. Only people who can edit the site see this note.", 'pinglide' )
			. '</p>';
	}

	/**
	 * A block brings its own wrapper attributes (alignment, margin, radius from
	 * the editor's controls); the shortcode brings none, so it gets the block's
	 * class and the alignment class themes already style.
	 *
	 * @param string $attrs Already-escaped attributes, or ''.
	 * @param string $align One of ALIGNS, or ''.
	 */
	private static function wrapper_attrs( string $attrs, string $align ): string {
		if ( '' !== $attrs ) {
			return $attrs;
		}

		$class = 'wp-block-pinglide-map' . ( '' !== $align ? ' align' . $align : '' );

		return 'class="' . esc_attr( $class ) . '"';
	}

	/**
	 * Tag ids as Pinglide mints them. Anything else is dropped rather than
	 * escaped: it cannot match a tag, so it would only filter the map to nothing
	 * (which the embed answers with the whole map anyway).
	 *
	 * @param array $tags Candidate ids.
	 */
	private static function clean_tags( array $tags ): array {
		$out = array();

		foreach ( $tags as $tag ) {
			$tag = trim( (string) $tag );
			if ( 1 === preg_match( '/^[A-Za-z0-9_-]{1,64}$/', $tag ) && ! in_array( $tag, $out, true ) ) {
				$out[] = $tag;
			}
		}

		return array_slice( $out, 0, 50 );
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
	public static function enqueue( $script ): void {
		// Checked again here, for anything stored before the return trip checked it.
		$src = $script && Pinglide_Slots::is_allowed_url( $script ) ? $script : PINGLIDE_EMBED_URL;

		wp_enqueue_script_module( 'pinglide-embed', esc_url_raw( $src ), array(), null );
	}
}
