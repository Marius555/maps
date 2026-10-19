<?php
/**
 * The Elementor widget itself. Required only from Pinglide_Elementor::register(),
 * after Elementor has loaded, because it extends Elementor's own class.
 *
 * @package Pinglide
 */

defined( 'ABSPATH' ) || exit;

use Elementor\Controls_Manager;
use Elementor\Widget_Base;

final class Pinglide_Elementor_Widget extends Widget_Base {

	public function get_name() {
		return 'pinglide-map';
	}

	public function get_title() {
		return __( 'Pinglide map', 'pinglide' );
	}

	public function get_icon() {
		return 'eicon-google-maps';
	}

	public function get_categories() {
		return array( 'general' );
	}

	public function get_keywords() {
		return array( 'map', 'locations', 'store locator', 'stockists', 'dealers', 'pinglide' );
	}

	protected function register_controls() {
		$slots   = Pinglide_Slots::all();
		$choices = array( '' => __( 'Choose a map', 'pinglide' ) );
		foreach ( $slots as $slot => $map ) {
			$choices[ $slot ] = $map['name'];
		}

		$this->start_controls_section( 'map_section', array( 'label' => __( 'Map', 'pinglide' ) ) );

		$this->add_control(
			'slot',
			array(
				'label'   => __( 'Map', 'pinglide' ),
				'type'    => Controls_Manager::SELECT,
				'options' => $choices,
				'default' => '',
			)
		);

		$this->add_control(
			'connect_note',
			array(
				'type'            => Controls_Manager::RAW_HTML,
				'raw'             => sprintf(
					/* translators: %s: link to Settings → Pinglide. */
					esc_html__( 'Maps connected on this site are listed above. To add another, open %s and press Connect a new map, then reload this editor.', 'pinglide' ),
					'<a href="' . esc_url( Pinglide_Admin::page_url() ) . '" target="_blank" rel="noopener">' . esc_html__( 'Settings → Pinglide', 'pinglide' ) . '</a>'
				),
				'content_classes' => 'elementor-descriptor',
			)
		);

		// One tag list per map, shown only while that map is chosen: each map has its own tags.
		foreach ( $slots as $slot => $map ) {
			$options = Pinglide_Elementor::tag_options( $map );

			$this->add_control(
				Pinglide_Elementor::tags_control( $slot ),
				array(
					'label'       => __( 'Show only these tags', 'pinglide' ),
					'type'        => Controls_Manager::SELECT2,
					'multiple'    => true,
					'label_block' => true,
					'options'     => $options,
					'default'     => array(),
					'description' => $options
						? __( 'Leave empty to show every location.', 'pinglide' )
						: __( 'This map has no tags yet. Add tags to your locations on Pinglide and press Publish there, then reload this editor.', 'pinglide' ),
					'condition'   => array( 'slot' => $slot ),
				)
			);
		}

		$this->end_controls_section();

		$this->start_controls_section( 'size_section', array( 'label' => __( 'Size', 'pinglide' ) ) );

		$this->add_responsive_control(
			'height',
			array(
				'label'      => __( 'Height', 'pinglide' ),
				'type'       => Controls_Manager::SLIDER,
				'size_units' => array( 'px', 'vh' ),
				'range'      => array(
					'px' => array(
						'min'  => Pinglide_Embed::MIN_HEIGHT,
						'max'  => Pinglide_Embed::MAX_HEIGHT,
						'step' => 10,
					),
					'vh' => array(
						'min' => 20,
						'max' => 100,
					),
				),
				'default'    => array(
					'unit' => 'px',
					'size' => Pinglide_Embed::DEFAULT_HEIGHT,
				),
				// !important: the embed gives its canvas an inline height, which this outranks.
				'selectors'  => array(
					'{{WRAPPER}} .pinglide-map__canvas' => 'height: {{SIZE}}{{UNIT}} !important;',
				),
			)
		);

		$this->add_responsive_control(
			'width',
			array(
				'label'          => __( 'Width', 'pinglide' ),
				'type'           => Controls_Manager::SLIDER,
				'size_units'     => array( '%' ),
				'range'          => array(
					'%' => array(
						'min' => Pinglide_Embed::MIN_WIDTH,
						'max' => 100,
					),
				),
				'default'        => array(
					'unit' => '%',
					'size' => 100,
				),
				// Phones get the whole width unless asked otherwise, as the block does.
				'mobile_default' => array(
					'unit' => '%',
					'size' => 100,
				),
				'selectors'      => array(
					'{{WRAPPER}} .wp-block-pinglide-map' => 'width: {{SIZE}}{{UNIT}}; max-width: 100%;',
				),
			)
		);

		$this->add_responsive_control(
			'align',
			array(
				'label'                => __( 'Alignment', 'pinglide' ),
				'type'                 => Controls_Manager::CHOOSE,
				'options'              => array(
					'left'   => array(
						'title' => __( 'Left', 'pinglide' ),
						'icon'  => 'eicon-h-align-left',
					),
					'center' => array(
						'title' => __( 'Centre', 'pinglide' ),
						'icon'  => 'eicon-h-align-center',
					),
					'right'  => array(
						'title' => __( 'Right', 'pinglide' ),
						'icon'  => 'eicon-h-align-right',
					),
				),
				'selectors_dictionary' => array(
					'left'   => 'margin-left: 0; margin-right: auto;',
					'center' => 'margin-left: auto; margin-right: auto;',
					'right'  => 'margin-left: auto; margin-right: 0;',
				),
				'selectors'            => array(
					'{{WRAPPER}} .wp-block-pinglide-map' => '{{VALUE}}',
				),
			)
		);

		$this->add_responsive_control(
			'radius',
			array(
				'label'      => __( 'Corner radius', 'pinglide' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => array( 'px', '%' ),
				'selectors'  => array(
					'{{WRAPPER}} .wp-block-pinglide-map' => 'border-radius: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}}; overflow: hidden;',
				),
			)
		);

		$this->end_controls_section();

		$this->start_controls_section( 'loading_section', array( 'label' => __( 'Loading', 'pinglide' ) ) );

		$this->add_control(
			'eager',
			array(
				'label'       => __( 'Load straight away', 'pinglide' ),
				'type'        => Controls_Manager::SWITCHER,
				'description' => __( 'Maps normally load when they are scrolled near, which keeps the page fast. Turn this on when the map is at the top of the page.', 'pinglide' ),
				'default'     => '',
			)
		);

		$this->end_controls_section();
	}

	protected function render() {
		$settings = $this->get_settings_for_display();
		$slot     = isset( $settings['slot'] ) ? (string) $settings['slot'] : '';
		$control  = Pinglide_Elementor::tags_control( $slot );
		$tags     = isset( $settings[ $control ] ) && is_array( $settings[ $control ] ) ? $settings[ $control ] : array();
		$height   = isset( $settings['height']['unit'], $settings['height']['size'] ) && 'px' === $settings['height']['unit']
			? $settings['height']['size']
			: Pinglide_Embed::DEFAULT_HEIGHT;

		if ( self::editing() ) {
			$this->render_preview( $slot, $tags );
			return;
		}

		$html = Pinglide_Embed::render(
			$slot,
			array(
				'height' => $height,
				'tags'   => $tags,
				'eager'  => 'yes' === ( isset( $settings['eager'] ) ? $settings['eager'] : '' ),
			),
			'',
			false
		);

		echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped in Pinglide_Embed::render().
	}

	/**
	 * Elementor redraws a widget by swapping its HTML in, long after the embed has
	 * booted, so a map rendered the visitor's way would vanish on the first
	 * change. The editor gets the preview page in a frame instead, which reloads
	 * with each change and is sized by the same CSS as the real thing.
	 *
	 * @param string $slot Slot id.
	 * @param array  $tags Tag ids.
	 */
	private function render_preview( string $slot, array $tags ): void {
		if ( ! Pinglide_Slots::get( $slot ) ) {
			printf(
				'<div class="elementor-alert elementor-alert-info">%s</div>',
				esc_html__( 'Choose a map in the panel. No maps listed? Connect one on Settings → Pinglide first.', 'pinglide' )
			);
			return;
		}

		printf(
			'<div class="wp-block-pinglide-map"><div class="pinglide-map__canvas" style="position:relative"><iframe src="%s" title="%s" style="display:block;width:100%%;height:100%%;border:0"></iframe></div></div>',
			esc_url( Pinglide_Embed::preview_url( $slot, array( 'tags' => $tags ) ) ),
			esc_attr__( 'Pinglide map preview', 'pinglide' )
		);
	}

	private static function editing(): bool {
		$elementor = \Elementor\Plugin::$instance;

		return ( isset( $elementor->editor ) && $elementor->editor->is_edit_mode() )
			|| ( isset( $elementor->preview ) && $elementor->preview->is_preview_mode() );
	}
}
