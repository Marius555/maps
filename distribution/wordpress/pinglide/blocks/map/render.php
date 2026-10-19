<?php
/**
 * The block on a visitor's page. Everything printed is escaped by
 * Pinglide_Embed::render(); it cannot go through wp_kses, which strips the
 * data-only <script> tag the map is mounted from.
 *
 * @package Pinglide
 *
 * @var array $attributes Block attributes.
 */

defined( 'ABSPATH' ) || exit;

$pinglide_slot = isset( $attributes['slot'] ) ? (string) $attributes['slot'] : '';

if ( ! Pinglide_Slots::get( $pinglide_slot ) ) {
	// Not set up: no wrapper, so a visitor's page has no empty box with margins.
	echo Pinglide_Embed::not_set_up(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- static, escaped.
	return;
}

$pinglide_html = Pinglide_Embed::render(
	$pinglide_slot,
	array(
		'height'        => isset( $attributes['height'] ) ? $attributes['height'] : Pinglide_Embed::DEFAULT_HEIGHT,
		'mobile_height' => isset( $attributes['mobileHeight'] ) ? $attributes['mobileHeight'] : 0,
		'width'         => isset( $attributes['width'] ) ? $attributes['width'] : 100,
		'align'         => isset( $attributes['align'] ) ? $attributes['align'] : '',
		'tags'          => isset( $attributes['tags'] ) && is_array( $attributes['tags'] ) ? $attributes['tags'] : array(),
		'eager'         => ! empty( $attributes['eager'] ),
	),
	get_block_wrapper_attributes()
);

echo $pinglide_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped in Pinglide_Embed::render(); the wrapper by core.
