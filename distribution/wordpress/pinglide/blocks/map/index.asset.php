<?php
/**
 * The editor script's dependencies. Written by hand because index.js is plain
 * JavaScript with no build step — keep this list in step with the globals it
 * reads at the top of that file.
 *
 * @package Pinglide
 */

return array(
	'dependencies' => array( 'wp-api-fetch', 'wp-block-editor', 'wp-blocks', 'wp-components', 'wp-element', 'wp-i18n' ),
	'version'      => '0.1.0',
);
