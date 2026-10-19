<?php
/**
 * [pinglide slot="…" height="520" mobile_height="400" width="60" align="right" tags="id,id" eager="yes"]
 *
 * For the classic editor and page builders that do not show blocks. The
 * settings page hands out the shortcode once a map is connected, and lists the
 * optional attributes beside it. Every attribute but `slot` means, when absent,
 * what the 0.1.0 shortcode did.
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
				'slot'          => '',
				'height'        => Pinglide_Embed::DEFAULT_HEIGHT,
				'mobile_height' => 0,
				'width'         => 100,
				'align'         => '',
				'tags'          => '',
				'eager'         => '',
			),
			$atts,
			'pinglide'
		);

		$slot = (string) $atts['slot'];
		unset( $atts['slot'] );

		return Pinglide_Embed::render( $slot, $atts );
	}
}
