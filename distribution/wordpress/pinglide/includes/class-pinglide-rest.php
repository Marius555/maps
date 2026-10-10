<?php
/**
 * The block editor's one question: is this slot connected yet?
 *
 * Asked by the editor, never by a visitor. The editor asks again whenever its
 * tab regains focus, which is how a block flips from "Set up this map" to the
 * map's name when the owner comes back from pinglide.com.
 *
 * @package Pinglide
 */

defined( 'ABSPATH' ) || exit;

final class Pinglide_Rest {

	public static function init(): void {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
	}

	public static function routes(): void {
		register_rest_route(
			'pinglide/v1',
			'/slots/(?P<slot>[A-Za-z0-9-]{8,64})',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'slot' ),
				'permission_callback' => static function () {
					return current_user_can( 'edit_posts' );
				},
			)
		);
	}

	/**
	 * @param WP_REST_Request $request The request.
	 */
	public static function slot( $request ): WP_REST_Response {
		$slot = (string) $request['slot'];
		$map  = Pinglide_Slots::get( $slot );

		return new WP_REST_Response(
			array(
				'connected'  => (bool) $map,
				'map'        => $map
					? array(
						'name'    => $map['name'],
						'editUrl' => Pinglide_Slots::edit_url( $map ),
					)
					: null,
				// Carries a nonce for this user, so it is minted per request.
				'connectUrl' => Pinglide_Connect::url( $slot ),
			)
		);
	}
}
