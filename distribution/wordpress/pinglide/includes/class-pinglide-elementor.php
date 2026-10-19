<?php
/**
 * The Pinglide map as a native Elementor widget, for sites built in Elementor,
 * where blocks do not show. Loaded only when Elementor is.
 *
 * Elementor's panel cannot make the round trip to pinglide.com the block makes,
 * so a map is connected once on Settings → Pinglide and then chosen from a list
 * here. Sizing is Elementor's own responsive controls, which write their own
 * per-device CSS — so the widget asks Pinglide_Embed for the map without its
 * size rules.
 *
 * @package Pinglide
 */

defined( 'ABSPATH' ) || exit;

final class Pinglide_Elementor {

	/** One transient for every map's tags, so uninstall has one thing to delete. */
	const TAGS_CACHE = 'pinglide_tags';
	const TAGS_TTL   = 10 * MINUTE_IN_SECONDS;

	public static function init(): void {
		add_action( 'elementor/widgets/register', array( __CLASS__, 'register' ) );
	}

	/**
	 * @param \Elementor\Widgets_Manager $widgets Elementor's widget registry.
	 */
	public static function register( $widgets ): void {
		require_once PINGLIDE_DIR . 'includes/elementor/class-pinglide-elementor-widget.php';

		$widgets->register( new Pinglide_Elementor_Widget() );
	}

	/**
	 * A connected map's tags, as Elementor select options: `id => "Group › Tag"`.
	 *
	 * **Editor only.** Read from the map's public snapshot on Pinglide's CDN, and
	 * only while an editor is building the widget's panel — never while a page is
	 * served, which keeps a visitor's page free of any request from this server.
	 * Cached briefly so opening the panel twice is one fetch.
	 *
	 * @param array $map A stored connection.
	 * @return array<string, string>
	 */
	public static function tag_options( array $map ): array {
		if ( ! is_admin() || ! current_user_can( 'edit_posts' ) || ! Pinglide_Slots::is_allowed_url( $map['snapshot'] ) ) {
			return array();
		}

		$cache = get_transient( self::TAGS_CACHE );
		$cache = is_array( $cache ) ? $cache : array();
		$url   = $map['snapshot'];

		if ( isset( $cache[ $url ] ) && is_array( $cache[ $url ] ) ) {
			return $cache[ $url ];
		}

		$response = wp_safe_remote_get( $url, array( 'timeout' => 5 ) );
		if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
			return array();
		}

		$snapshot = json_decode( wp_remote_retrieve_body( $response ), true );
		$groups   = is_array( $snapshot ) && isset( $snapshot['tagGroups'] ) && is_array( $snapshot['tagGroups'] ) ? $snapshot['tagGroups'] : array();
		$options  = array();

		foreach ( $groups as $group ) {
			if ( ! is_array( $group ) || empty( $group['tags'] ) || ! is_array( $group['tags'] ) ) {
				continue;
			}

			foreach ( $group['tags'] as $tag ) {
				if ( ! isset( $tag['id'], $tag['label'] ) ) {
					continue;
				}

				$label                          = (string) $tag['label'];
				$options[ (string) $tag['id'] ] = count( $groups ) > 1 && ! empty( $group['label'] )
					? $group['label'] . ' › ' . $label
					: $label;
			}
		}

		$cache[ $url ] = $options;
		set_transient( self::TAGS_CACHE, $cache, self::TAGS_TTL );

		return $options;
	}

	/**
	 * Elementor control names must be plain words; slot ids carry hyphens.
	 *
	 * @param string $slot Slot id.
	 */
	public static function tags_control( string $slot ): string {
		return 'tags_' . str_replace( '-', '_', $slot );
	}
}
