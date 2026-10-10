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

$pinglide_html = Pinglide_Embed::render(
	isset( $attributes['slot'] ) ? (string) $attributes['slot'] : '',
	isset( $attributes['height'] ) ? $attributes['height'] : Pinglide_Embed::DEFAULT_HEIGHT
);

if ( '' === $pinglide_html ) {
	return;
}

printf(
	'<div %s>%s</div>',
	get_block_wrapper_attributes(), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped by core.
	$pinglide_html // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped in Pinglide_Embed::render().
);
