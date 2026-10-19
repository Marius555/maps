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
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'scripts' ) );
	}

	/**
	 * The shortcode's Copy buttons. A few lines, inline on an empty handle, and
	 * only on this page.
	 *
	 * @param string $hook The admin page being loaded.
	 */
	public static function scripts( $hook ): void {
		if ( 'settings_page_' . self::PAGE !== $hook ) {
			return;
		}

		wp_register_script( 'pinglide-admin', false, array(), PINGLIDE_VERSION, true );
		wp_enqueue_script( 'pinglide-admin' );
		wp_add_inline_script(
			'pinglide-admin',
			sprintf(
				// No clipboard (a site on plain http) or a refusal: select the code so the keyboard can copy it.
				'document.addEventListener("click",function(e){var b=e.target.closest("[data-pinglide-copy]");if(!b)return;var c=b.previousElementSibling;function sel(){var r=document.createRange();r.selectNodeContents(c);var s=getSelection();s.removeAllRanges();s.addRange(r);b.textContent=%3$s}function done(){b.textContent=%1$s;setTimeout(function(){b.textContent=%2$s},2000)}if(!navigator.clipboard){sel();return}navigator.clipboard.writeText(b.getAttribute("data-pinglide-copy")).then(done,sel)});',
				wp_json_encode( __( 'Copied', 'pinglide' ) ),
				wp_json_encode( __( 'Copy', 'pinglide' ) ),
				wp_json_encode( __( 'Selected — copy it', 'pinglide' ) )
			)
		);
	}

	/**
	 * The shortcode the settings page hands out: the slot and today's default
	 * height, so the one attribute people change most is already there to edit.
	 *
	 * @param string $slot Slot id.
	 */
	public static function shortcode( string $slot ): string {
		return sprintf( '[pinglide slot="%s" height="%d"]', $slot, Pinglide_Embed::DEFAULT_HEIGHT );
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
		$connected_slot = isset( $_GET['connected'] ) ? sanitize_text_field( wp_unslash( $_GET['connected'] ) ) : '';
		$connected      = '' !== $connected_slot ? Pinglide_Slots::get( $connected_slot ) : null;
		$disconnected   = isset( $_GET['disconnected'] );
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
						<?php echo Pinglide_Pages::button( $connected_slot ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped in Pinglide_Pages::button(). ?>
					</p>
				</div>
			<?php elseif ( $disconnected ) : ?>
				<div class="notice notice-info"><p><?php esc_html_e( 'Disconnected. That map no longer shows on this site; it is still in your Pinglide account.', 'pinglide' ); ?></p></div>
			<?php endif; ?>

			<p>
				<?php esc_html_e( 'Using the block editor? Add the “Pinglide map” block to any page and press Set up this map. Using Elementor? Connect a map here, then add the Pinglide map widget and choose it. Using another page builder or the classic editor? Connect a map here, then paste its shortcode where it should appear.', 'pinglide' ); ?>
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
								<td>
									<code><?php echo esc_html( self::shortcode( $slot ) ); ?></code>
									<button type="button" class="button button-small" data-pinglide-copy="<?php echo esc_attr( self::shortcode( $slot ) ); ?>"><?php esc_html_e( 'Copy', 'pinglide' ); ?></button>
								</td>
								<td><?php echo esc_html( wp_date( get_option( 'date_format' ), (int) $map['connected_at'] ) ); ?></td>
								<td>
									<?php echo Pinglide_Pages::button( $slot, 'button button-small' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped in Pinglide_Pages::button(). ?>
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

				<h2><?php esc_html_e( 'Sizing a shortcode', 'pinglide' ); ?></h2>
				<p><?php esc_html_e( 'The block has these as controls in its sidebar. In a shortcode, add any of them inside the brackets:', 'pinglide' ); ?></p>
				<ul style="list-style:disc;padding-left:2em">
					<li><code>height="520"</code> — <?php esc_html_e( 'height in pixels, 240 to 1200.', 'pinglide' ); ?></li>
					<li><code>mobile_height="400"</code> — <?php esc_html_e( 'a different height on phones (screens narrower than 600px).', 'pinglide' ); ?></li>
					<li><code>width="60"</code> — <?php esc_html_e( 'width as a percentage of the content area. Phones always show the map full width.', 'pinglide' ); ?></li>
					<li><code>align="center"</code> — <?php esc_html_e( 'left, center or right for a narrower map (text flows beside left and right), or wide or full.', 'pinglide' ); ?></li>
					<li><code>eager="yes"</code> — <?php esc_html_e( 'load the map straight away, for a map at the top of the page.', 'pinglide' ); ?></li>
				</ul>
				<p><?php esc_html_e( 'To show only some locations, use the block’s “Locations shown” panel, or the Elementor widget’s Tags setting.', 'pinglide' ); ?></p>
			<?php endif; ?>
		</div>
		<?php
	}
}
