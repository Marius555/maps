/**
 * The Pinglide map block in the editor.
 *
 * Plain JavaScript against WordPress's own globals, so the plugin has no build
 * step: what is in this folder is what ships. `index.asset.php` lists the
 * globals read below as script dependencies — keep the two in step.
 *
 * The block holds a random `slot`, minted the first time it is inserted. Which
 * map the slot shows is decided on pinglide.com and stored by the plugin
 * (`includes/class-pinglide-slots.php`); this script only asks whether that has
 * happened yet — on load, whenever the tab regains focus, and every few seconds
 * while a setup tab is open.
 */
( function ( blocks, element, blockEditor, components, i18n, apiFetch ) {
	'use strict';

	var el = element.createElement;
	var useEffect = element.useEffect;
	var useState = element.useState;
	var useCallback = element.useCallback;
	var useBlockProps = blockEditor.useBlockProps;
	var InspectorControls = blockEditor.InspectorControls;
	var Placeholder = components.Placeholder;
	var Button = components.Button;
	var Spinner = components.Spinner;
	var PanelBody = components.PanelBody;
	var RangeControl = components.RangeControl;
	var Notice = components.Notice;
	var __ = i18n.__;

	/** How often to ask while the owner is away on pinglide.com, and for how long. */
	var POLL_MS = 3000;
	var POLL_FOR_MS = 15 * 60 * 1000;

	function newSlot() {
		if ( window.crypto && typeof window.crypto.randomUUID === 'function' ) {
			return window.crypto.randomUUID();
		}

		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace( /[xy]/g, function ( c ) {
			var r = ( Math.random() * 16 ) | 0;
			return ( c === 'x' ? r : ( r & 0x3 ) | 0x8 ).toString( 16 );
		} );
	}

	/** `GET /wp-json/pinglide/v1/slots/{slot}` — `includes/class-pinglide-rest.php`. */
	function useSlot( slot ) {
		var pair = useState( null );
		var state = pair[ 0 ];
		var setState = pair[ 1 ];

		var load = useCallback(
			function () {
				if ( ! slot ) {
					return;
				}

				apiFetch( { path: '/pinglide/v1/slots/' + encodeURIComponent( slot ) } )
					.then( setState )
					.catch( function () {
						setState( { failed: true } );
					} );
			},
			[ slot ]
		);

		useEffect(
			function () {
				load();
				window.addEventListener( 'focus', load );

				return function () {
					window.removeEventListener( 'focus', load );
				};
			},
			[ load ]
		);

		return [ state, load ];
	}

	/** Ask on a timer from the moment a setup tab is opened until it answers. */
	function usePolling( load, active ) {
		useEffect(
			function () {
				if ( ! active ) {
					return;
				}

				var started = Date.now();
				var timer = window.setInterval( function () {
					if ( Date.now() - started > POLL_FOR_MS ) {
						window.clearInterval( timer );
						return;
					}
					load();
				}, POLL_MS );

				return function () {
					window.clearInterval( timer );
				};
			},
			[ load, active ]
		);
	}

	function openSetup( url, onOpened ) {
		window.open( url, '_blank', 'noopener' );
		onOpened();
	}

	function NotConnected( props ) {
		return el(
			Placeholder,
			{
				icon: 'location-alt',
				label: __( 'Pinglide map', 'pinglide' ),
				instructions: __(
					'Show your locations on a map. Set it up on Pinglide — a free account, and nothing to copy or paste. This page updates by itself whenever you change the map there.',
					'pinglide'
				),
			},
			el(
				'div',
				{ className: 'pinglide-actions' },
				el(
					Button,
					{
						variant: 'primary',
						onClick: function () {
							openSetup( props.connectUrl, props.onOpened );
						},
					},
					__( 'Set up this map', 'pinglide' )
				),
				props.waiting
					? el( 'span', null, el( Spinner ), ' ', __( 'Waiting for Pinglide…', 'pinglide' ) )
					: null
			)
		);
	}

	function Connected( props ) {
		return el(
			Placeholder,
			{
				icon: 'location-alt',
				label: props.map.name,
				instructions: __(
					'Visitors see this map on the published page. Add and edit locations on Pinglide and press Publish there — this page updates by itself.',
					'pinglide'
				),
			},
			el(
				'div',
				{ className: 'pinglide-actions' },
				el(
					Button,
					{ variant: 'primary', href: props.map.editUrl, target: '_blank', rel: 'noopener' },
					__( 'Edit locations on Pinglide', 'pinglide' )
				),
				el(
					Button,
					{
						variant: 'secondary',
						onClick: function () {
							openSetup( props.connectUrl, props.onOpened );
						},
					},
					__( 'Change map', 'pinglide' )
				)
			)
		);
	}

	function Edit( props ) {
		var attributes = props.attributes;
		var setAttributes = props.setAttributes;
		var slot = attributes.slot;

		var waitingPair = useState( false );
		var waiting = waitingPair[ 0 ];
		var setWaiting = waitingPair[ 1 ];

		// First insert: give this block its own slot. Saved with the post.
		useEffect(
			function () {
				if ( ! slot ) {
					setAttributes( { slot: newSlot() } );
				}
			},
			[ slot ]
		);

		var slotState = useSlot( slot );
		var state = slotState[ 0 ];
		var load = slotState[ 1 ];

		usePolling( load, waiting );

		var connectedName = state && state.connected ? state.map.name : null;
		useEffect(
			function () {
				setWaiting( false );
			},
			[ connectedName ]
		);

		var body;
		if ( ! state ) {
			body = el( Placeholder, { icon: 'location-alt', label: __( 'Pinglide map', 'pinglide' ) }, el( Spinner ) );
		} else if ( state.failed ) {
			body = el(
				Notice,
				{ status: 'error', isDismissible: false },
				__( "Couldn't check this map's setup. Reload the editor and try again.", 'pinglide' )
			);
		} else if ( state.connected ) {
			body = el( Connected, {
				map: state.map,
				connectUrl: state.connectUrl,
				onOpened: function () {
					setWaiting( true );
				},
			} );
		} else {
			body = el( NotConnected, {
				connectUrl: state.connectUrl,
				waiting: waiting,
				onOpened: function () {
					setWaiting( true );
				},
			} );
		}

		return el(
			'div',
			useBlockProps(),
			el(
				InspectorControls,
				null,
				el(
					PanelBody,
					{ title: __( 'Map', 'pinglide' ) },
					el( RangeControl, {
						label: __( 'Height (px)', 'pinglide' ),
						value: attributes.height,
						min: 240,
						max: 1200,
						step: 10,
						onChange: function ( value ) {
							setAttributes( { height: value || 520 } );
						},
						__nextHasNoMarginBottom: true,
					} )
				)
			),
			body
		);
	}

	blocks.registerBlockType( 'pinglide/map', {
		edit: Edit,
		// Rendered on the server (render.php), so nothing is saved into the post but the attributes.
		save: function () {
			return null;
		},
	} );
} )(
	window.wp.blocks,
	window.wp.element,
	window.wp.blockEditor,
	window.wp.components,
	window.wp.i18n,
	window.wp.apiFetch
);
