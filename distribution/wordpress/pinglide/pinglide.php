<?php
/**
 * Plugin Name:       Pinglide Maps
 * Plugin URI:        https://pinglide.com
 * Description:       Put your locations on a map. Drop the Pinglide map block on a page, connect it to your Pinglide account, and manage the locations there — your page updates by itself.
 * Version:           0.1.0
 * Requires at least: 6.5
 * Requires PHP:      7.4
 * Author:            Pinglide
 * Author URI:        https://pinglide.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       pinglide
 *
 * @package Pinglide
 */

defined( 'ABSPATH' ) || exit;

define( 'PINGLIDE_VERSION', '0.1.0' );
define( 'PINGLIDE_DIR', plugin_dir_path( __FILE__ ) );
define( 'PINGLIDE_BASENAME', plugin_basename( __FILE__ ) );

/*
 * Where Pinglide lives. Both can be overridden in wp-config.php, which is how a
 * development copy points at `npm run dev`:
 *
 *   define( 'PINGLIDE_APP_URL', 'http://localhost:3000' );
 *
 * PINGLIDE_EMBED_URL is only a fallback — every connection stores the script URL
 * the Pinglide server answered with, so a dev connection loads the dev bundle.
 */
if ( ! defined( 'PINGLIDE_APP_URL' ) ) {
	define( 'PINGLIDE_APP_URL', 'https://pinglide.com' );
}
if ( ! defined( 'PINGLIDE_EMBED_URL' ) ) {
	define( 'PINGLIDE_EMBED_URL', 'https://cdn.pinglide.com/embed/v1/map.js' );
}

require_once PINGLIDE_DIR . 'includes/class-pinglide-slots.php';
require_once PINGLIDE_DIR . 'includes/class-pinglide-embed.php';
require_once PINGLIDE_DIR . 'includes/class-pinglide-connect.php';
require_once PINGLIDE_DIR . 'includes/class-pinglide-rest.php';
require_once PINGLIDE_DIR . 'includes/class-pinglide-shortcode.php';
require_once PINGLIDE_DIR . 'includes/class-pinglide-admin.php';

Pinglide_Connect::init();
Pinglide_Rest::init();
Pinglide_Shortcode::init();
Pinglide_Admin::init();

add_action(
	'init',
	static function () {
		register_block_type( PINGLIDE_DIR . 'blocks/map' );
	}
);
