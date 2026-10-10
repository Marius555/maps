<?php
/**
 * The round trip to pinglide.com and back.
 *
 *   1. "Set up this map" opens pinglide.com/connect/wordpress with this site's
 *      address, where to come back to, the slot, and a nonce.
 *   2. The owner signs up or logs in there and picks or creates a map.
 *   3. Pinglide sends the browser to admin-post.php?action=pinglide_connect with
 *      the map's id, name and public snapshot URL, and the nonce.
 *   4. handle() checks the nonce against this user and this slot, and stores it.
 *
 * Nothing secret travels either way: the snapshot is public already. The nonce is
 * what stops a link somebody else crafted from pointing a block at their map —
 * it is tied to the logged-in user, the slot, and expires within a day.
 *
 * @package Pinglide
 */

defined( 'ABSPATH' ) || exit;

final class Pinglide_Connect {

	const ACTION     = 'pinglide_connect';
	const NEW_ACTION = 'pinglide_new_map';

	public static function init(): void {
		add_action( 'admin_post_' . self::ACTION, array( __CLASS__, 'handle' ) );
		add_action( 'admin_post_' . self::NEW_ACTION, array( __CLASS__, 'start_new' ) );
	}

	/**
	 * The pinglide.com page that sets up `$slot`.
	 *
	 * @param string $slot Slot id.
	 */
	public static function url( $slot ): string {
		$query = array(
			'site'   => home_url( '/' ),
			'return' => admin_url( 'admin-post.php' ),
			'state'  => wp_create_nonce( self::nonce_action( $slot ) ),
			'slot'   => $slot,
			'title'  => wp_strip_all_tags( get_bloginfo( 'name' ) ),
		);

		return untrailingslashit( PINGLIDE_APP_URL ) . '/connect/wordpress?'
			. http_build_query( $query, '', '&', PHP_QUERY_RFC3986 );
	}

	/**
	 * Pinglide's answer arriving back. Linked to, so it is a GET.
	 */
	public static function handle(): void {
		// phpcs:disable WordPress.Security.NonceVerification.Recommended -- verified below, against the slot it names.
		$slot     = self::param( 'slot' );
		$state    = self::param( 'state' );
		$map_id   = self::param( 'map' );
		$name     = self::param( 'name' );
		$snapshot = isset( $_GET['snapshot'] ) ? esc_url_raw( wp_unslash( $_GET['snapshot'] ), array( 'https', 'http' ) ) : '';
		$script   = isset( $_GET['script'] ) ? esc_url_raw( wp_unslash( $_GET['script'] ), array( 'https', 'http' ) ) : '';
		// phpcs:enable

		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_die( esc_html__( "You don't have permission to set up maps on this site.", 'pinglide' ), 403 );
		}

		if ( ! Pinglide_Slots::is_valid_id( $slot ) || ! wp_verify_nonce( $state, self::nonce_action( $slot ) ) ) {
			wp_die(
				esc_html__( 'This link has expired or was meant for another account. Go back to the page editor and press Set up this map again.', 'pinglide' ),
				esc_html__( 'Map not connected', 'pinglide' ),
				array( 'response' => 403 )
			);
		}

		if ( 1 !== preg_match( '/^[A-Za-z0-9_-]{1,36}$/', $map_id ) || '' === $snapshot ) {
			wp_die(
				esc_html__( "Pinglide's answer was incomplete, so nothing was changed. Press Set up this map again.", 'pinglide' ),
				esc_html__( 'Map not connected', 'pinglide' ),
				array( 'response' => 400 )
			);
		}

		Pinglide_Slots::set(
			$slot,
			array(
				'map'      => $map_id,
				'name'     => '' !== $name ? $name : __( 'Pinglide map', 'pinglide' ),
				'snapshot' => $snapshot,
				'script'   => $script,
			)
		);

		wp_safe_redirect( Pinglide_Admin::page_url( array( 'connected' => $slot ) ) );
		exit;
	}

	/**
	 * Settings → Pinglide → "Connect a new map", for the classic editor and page
	 * builders: a fresh slot, straight to pinglide.com. The shortcode for it is on
	 * the settings page once it comes back.
	 */
	public static function start_new(): void {
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_die( esc_html__( "You don't have permission to set up maps on this site.", 'pinglide' ), 403 );
		}

		check_admin_referer( self::NEW_ACTION );

		// Not wp_safe_redirect: pinglide.com is, by design, another host.
		wp_redirect( self::url( wp_generate_uuid4() ) ); // phpcs:ignore WordPress.Security.SafeRedirect.wp_redirect_wp_redirect
		exit;
	}

	/**
	 * @param string $slot Slot id.
	 */
	private static function nonce_action( $slot ): string {
		return self::ACTION . '|' . $slot;
	}

	/**
	 * @param string $key Query parameter.
	 */
	private static function param( $key ): string {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- see handle().
		return isset( $_GET[ $key ] ) ? sanitize_text_field( wp_unslash( $_GET[ $key ] ) ) : '';
	}
}
