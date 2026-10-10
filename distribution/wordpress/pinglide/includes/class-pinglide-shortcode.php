<?php
/**
 * [pinglide slot="…" height="520"] — for the classic editor and page builders
 * (Elementor, Divi, Beaver Builder) that do not show blocks. The settings page
 * hands out the shortcode once a map is connected.
 *
 * @package Pinglide
 */

defined( 'ABSPATH' ) || exit;

final class Pinglide_Shortcode {

	public static function init(): void {
		add_shortcode( 'pinglide', array( __CLASS__, 'render' ) );
	}

	/**
	 * @param array|string $atts Shortcode attributes.
	 */
	public static function render( $atts ): string {
		$atts = shortcode_atts(
			array(
				'slot'   => '',
				'height' => Pinglide_Embed::DEFAULT_HEIGHT,
			),
			$atts,
			'pinglide'
		);

		$html = Pinglide_Embed::render( (string) $atts['slot'], $atts['height'] );

		return '' === $html ? '' : '<div class="wp-block-pinglide-map">' . $html . '</div>';
	}
}
