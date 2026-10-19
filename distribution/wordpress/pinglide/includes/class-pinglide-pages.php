<?php
/**
 * Settings → Pinglide → "Create a page with this map": a draft page holding the
 * map block, already connected, opened in the editor. The fastest way from a
 * connected map to a store locator page, with nothing to find or paste.
 *
 * The new block shares the slot of the row it was made from, which is what a
 * copied block does too (`class-pinglide-slots.php`): both show that map, and
 * changing the map on one changes it on both.
 *
 * @package Pinglide
 */

defined( 'ABSPATH' ) || exit;

final class Pinglide_Pages {

	const ACTION = 'pinglide_create_page';

	public static function init(): void {
		add_action( 'admin_post_' . self::ACTION, array( __CLASS__, 'create' ) );
	}

	public static function create(): void {
		if ( ! current_user_can( 'edit_pages' ) ) {
			wp_die( esc_html__( "You don't have permission to create pages on this site.", 'pinglide' ), 403 );
		}

		check_admin_referer( self::ACTION );

		$slot = isset( $_POST['slot'] ) ? sanitize_text_field( wp_unslash( $_POST['slot'] ) ) : '';
		$map  = Pinglide_Slots::get( $slot );

		if ( ! $map ) {
			wp_die(
				esc_html__( "That map isn't connected on this site any more. Connect it again on Settings → Pinglide.", 'pinglide' ),
				esc_html__( 'Page not created', 'pinglide' ),
				array( 'response' => 404 )
			);
		}

		// Serialised by core, so the slot is escaped as block attributes are.
		$content = serialize_block(
			array(
				'blockName'    => 'pinglide/map',
				'attrs'        => array(
					'slot'  => $slot,
					'align' => 'wide',
				),
				'innerBlocks'  => array(),
				'innerHTML'    => '',
				'innerContent' => array(),
			)
		);

		$page = wp_insert_post(
			array(
				'post_type'    => 'page',
				'post_status'  => 'draft',
				'post_title'   => $map['name'],
				'post_content' => $content,
			),
			true
		);

		if ( is_wp_error( $page ) ) {
			wp_die(
				esc_html( $page->get_error_message() ),
				esc_html__( 'Page not created', 'pinglide' ),
				array( 'response' => 500 )
			);
		}

		wp_safe_redirect( get_edit_post_link( $page, 'raw' ) );
		exit;
	}

	/**
	 * The button, for the settings page's rows and its "connected" notice.
	 *
	 * @param string $slot  Slot id.
	 * @param string $class Button classes.
	 */
	public static function button( string $slot, string $class = 'button' ): string {
		if ( ! current_user_can( 'edit_pages' ) ) {
			return '';
		}

		return sprintf(
			'<form method="post" action="%s" style="display:inline"><input type="hidden" name="action" value="%s" /><input type="hidden" name="slot" value="%s" />%s<button type="submit" class="%s">%s</button></form>',
			esc_url( admin_url( 'admin-post.php' ) ),
			esc_attr( self::ACTION ),
			esc_attr( $slot ),
			wp_nonce_field( self::ACTION, '_wpnonce', true, false ),
			esc_attr( $class ),
			esc_html__( 'Create a page with this map', 'pinglide' )
		);
	}
}
