<?php
/**
 * Deleting the plugin forgets which map each block showed. The maps themselves
 * live in the owner's Pinglide account and are untouched.
 *
 * @package Pinglide
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

delete_option( 'pinglide_slots' );
