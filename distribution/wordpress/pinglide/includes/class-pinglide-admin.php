<?php
/**
 * Settings → Pinglide: every map connected on this site, where to edit it, and
 * the shortcode for builders that do not use blocks. Also where the round trip
 * from pinglide.com lands, with a note saying it worked.
 *
 * @package Pinglide
 */

defined( 'ABSPATH' ) || exit;

final class Pinglide_Admin {

	const PAGE              = 'pinglide';
	const DISCONNECT_ACTION = 'pinglide_disconnect';

	public static function init(): void {
		add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
		add_action( 'admin_post_' . self::DISCONNECT_ACTION, array( __CLASS__, 'disconnect' ) );
		add_filter( 'plugin_action_links_' . PINGLIDE_BASENAME, array( __CLASS__, 'action_links' ) );
	}

	/**
	 * @param array $args Extra query arguments.
	 */
	public static function page_url( array $args = array() ): string {
		return add_query_arg( array_merge( array( 'page' => self::PAGE ), $args ), admin_url( 'options-general.php' ) );
	}

	public static function menu(): void {
		add_options_page(
			__( 'Pinglide maps', 'pinglide' ),
			__( 'Pinglide', 'pinglide' ),
			'edit_posts',
			self::PAGE,
			array( __CLASS__, 'render' )
		);
	}

	/**
	 * @param array $links Existing links on the Plugins screen.
	 */
	public static function action_links( $links ): array {
		array_unshift(
			$links,
			sprintf( '<a href="%s">%s</a>', esc_url( self::page_url() ), esc_html__( 'Settings', 'pinglide' ) )
		);

		return $links;
	}

	public static function disconnect(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( "You don't have permission to disconnect maps on this site.", 'pinglide' ), 403 );
		}

		check_admin_referer( self::DISCONNECT_ACTION );

		$slot = isset( $_POST['slot'] ) ? sanitize_text_field( wp_unslash( $_POST['slot'] ) ) : '';
		Pinglide_Slots::remove( $slot );

		wp_safe_redirect( self::page_url( array( 'disconnected' => '1' ) ) );
		exit;
	}

	public static function render(): void {
		if ( ! current_user_can( 'edit_posts' ) ) {
			return;
		}

		$slots = Pinglide_Slots::all();
		// phpcs:disable WordPress.Security.NonceVerification.Recommended -- display only.
		$connected    = isset( $_GET['connected'] ) ? Pinglide_Slots::get( sanitize_text_field( wp_unslash( $_GET['connected'] ) ) ) : null;
		$disconnected = isset( $_GET['disconnected'] );
		// phpcs:enable
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Pinglide maps', 'pinglide' ); ?></h1>

			<?php if ( $connected ) : ?>
				<div class="notice notice-success">
					<p>
						<strong>
							<?php
							/* translators: %s: map name. */
							echo esc_html( sprintf( __( '%s is connected.', 'pinglide' ), $connected['name'] ) );
							?>
						</strong>
						<?php esc_html_e( "If you came from the page editor, switch back to that tab — the map is already in place. Add your locations on Pinglide and press Publish there; your page updates by itself.", 'pinglide' ); ?>
					</p>
					<p>
						<a class="button button-primary" href="<?php echo esc_url( Pinglide_Slots::edit_url( $connected ) ); ?>" target="_blank" rel="noopener">
							<?php esc_html_e( 'Add locations on Pinglide', 'pinglide' ); ?>
						</a>
					</p>
				</div>
			<?php elseif ( $disconnected ) : ?>
				<div class="notice notice-info"><p><?php esc_html_e( 'Disconnected. That map no longer shows on this site; it is still in your Pinglide account.', 'pinglide' ); ?></p></div>
			<?php endif; ?>

			<p>
				<?php esc_html_e( 'Using the block editor? Add the “Pinglide map” block to any page and press Set up this map. Using a page builder or the classic editor? Connect a map here, then paste its shortcode where it should appear.', 'pinglide' ); ?>
			</p>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="<?php echo esc_attr( Pinglide_Connect::NEW_ACTION ); ?>" />
				<?php wp_nonce_field( Pinglide_Connect::NEW_ACTION ); ?>
				<?php submit_button( __( 'Connect a new map', 'pinglide' ), 'secondary', 'submit', false ); ?>
			</form>

			<?php if ( empty( $slots ) ) : ?>
				<p><em><?php esc_html_e( 'No maps connected yet.', 'pinglide' ); ?></em></p>
			<?php else : ?>
				<table class="widefat striped" style="margin-top:1em">
					<thead>
						<tr>
							<th><?php esc_html_e( 'Map', 'pinglide' ); ?></th>
							<th><?php esc_html_e( 'Shortcode', 'pinglide' ); ?></th>
							<th><?php esc_html_e( 'Connected', 'pinglide' ); ?></th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						<?php foreach ( $slots as $slot => $map ) : ?>
							<tr>
								<td>
									<strong><?php echo esc_html( $map['name'] ); ?></strong><br />
									<a href="<?php echo esc_url( Pinglide_Slots::edit_url( $map ) ); ?>" target="_blank" rel="noopener"><?php esc_html_e( 'Edit locations on Pinglide', 'pinglide' ); ?></a>
								</td>
								<td><code>[pinglide slot="<?php echo esc_html( $slot ); ?>"]</code></td>
								<td><?php echo esc_html( wp_date( get_option( 'date_format' ), (int) $map['connected_at'] ) ); ?></td>
								<td>
									<?php if ( current_user_can( 'manage_options' ) ) : ?>
										<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
											<input type="hidden" name="action" value="<?php echo esc_attr( self::DISCONNECT_ACTION ); ?>" />
											<input type="hidden" name="slot" value="<?php echo esc_attr( $slot ); ?>" />
											<?php wp_nonce_field( self::DISCONNECT_ACTION ); ?>
											<?php submit_button( __( 'Disconnect', 'pinglide' ), 'link-delete small', 'submit', false ); ?>
										</form>
									<?php endif; ?>
								</td>
							</tr>
						<?php endforeach; ?>
					</tbody>
				</table>
			<?php endif; ?>
		</div>
		<?php
	}
}
