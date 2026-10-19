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
 *
 * Once it has, the block draws the real map: an iframe of the plugin's preview
 * page (`includes/class-pinglide-preview.php`), sized by the same rules a
 * visitor's page uses, so what the owner sees here is what goes live.
 */
( function ( blocks, element, blockEditor, components, i18n, apiFetch ) {
	'use strict';

	var el = element.createElement;
	var Fragment = element.Fragment;
	var useEffect = element.useEffect;
	var useState = element.useState;
	var useCallback = element.useCallback;
	var useBlockProps = blockEditor.useBlockProps;
	var InspectorControls = blockEditor.InspectorControls;
	var BlockControls = blockEditor.BlockControls;
	var Placeholder = components.Placeholder;
	var Button = components.Button;
	var Spinner = components.Spinner;
	var PanelBody = components.PanelBody;
	var RangeControl = components.RangeControl;
	var ToggleControl = components.ToggleControl;
	var CheckboxControl = components.CheckboxControl;
	var ToolbarGroup = components.ToolbarGroup;
	var ToolbarButton = components.ToolbarButton;
	var Notice = components.Notice;
	var __ = i18n.__;

	/** How often to ask while the owner is away on pinglide.com, and for how long. */
	var POLL_MS = 3000;
	var POLL_FOR_MS = 15 * 60 * 1000;

	/** Pinglide_Embed's limits and breakpoint — keep in step with class-pinglide-embed.php. */
	var MIN_HEIGHT = 240;
	var MAX_HEIGHT = 1200;
	var MIN_WIDTH = 20;
	var PHONE_MAX_WIDTH = 600;

	function newSlot() {
		if ( window.crypto && typeof window.crypto.randomUUID === 'function' ) {
			return window.crypto.randomUUID();
		}

		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace( /[xy]/g, function ( c ) {
			var r = ( Math.random() * 16 ) | 0;
			return ( c === 'x' ? r : ( r & 0x3 ) | 0x8 ).toString( 16 );
		} );
	}

	/**
	 * **Twin of Pinglide_Embed::css().** The same size rules, so the editor's
	 * preview is the published map's size — including the phone height, which
	 * shows when the editor's device preview is set to Mobile, because the
	 * editor canvas is then narrower than the breakpoint. Change one, change both.
	 */
	function sizeCss( sel, a ) {
		var canvas = sel + ' .pinglide-map__canvas';
		var css = sel + '{overflow:hidden}';
		var narrow = a.width < 100 && a.align !== 'wide' && a.align !== 'full';

		if ( narrow ) {
			// A share of the text column, not of the window — see the PHP twin.
			var content = 'var(--wp--style--global--content-size,100%)';
			css += sel + '{width:min(' + a.width + '%,calc(' + content + '*' + a.width + '/100));max-width:100%}';
			var edge = 'max(0px,calc((100% - ' + content + ')/2))';
			if ( a.align === 'center' ) {
				css += sel + '{margin-left:auto!important;margin-right:auto!important}';
			} else if ( a.align === 'left' ) {
				css += sel + '{float:left;margin-left:' + edge + '!important;margin-right:1.5em}';
			} else if ( a.align === 'right' ) {
				css += sel + '{float:right;margin-right:' + edge + '!important;margin-left:1.5em}';
			}
		}

		css += canvas + '{height:' + a.height + 'px!important}';

		var phone = '';
		if ( narrow ) {
			phone += sel + '{width:100%!important;float:none!important;margin-left:0!important;margin-right:0!important}';
		}
		if ( a.mobileHeight > 0 ) {
			phone += canvas + '{height:' + a.mobileHeight + 'px!important}';
		}
		if ( phone ) {
			css += '@media (max-width:' + PHONE_MAX_WIDTH + 'px){' + phone + '}';
		}

		return css;
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

	/**
	 * The map's tag groups, read from its published snapshot — a public CDN file,
	 * fetched by the editor's browser. `reloadKey` asks again after the owner
	 * republishes on Pinglide and presses Reload.
	 *
	 * @return {Array|null|false} Groups, null while loading, false when unreadable.
	 */
	function useTagGroups( snapshotUrl, reloadKey ) {
		var pair = useState( null );
		var groups = pair[ 0 ];
		var setGroups = pair[ 1 ];

		useEffect(
			function () {
				if ( ! snapshotUrl ) {
					return;
				}

				var live = true;
				setGroups( null );
				window
					.fetch( snapshotUrl, { cache: 'no-cache' } )
					.then( function ( response ) {
						if ( ! response.ok ) {
							throw new Error( String( response.status ) );
						}
						return response.json();
					} )
					.then( function ( snapshot ) {
						if ( ! live ) {
							return;
						}
						var all = Array.isArray( snapshot.tagGroups ) ? snapshot.tagGroups : [];
						setGroups(
							all.filter( function ( group ) {
								return group && Array.isArray( group.tags ) && group.tags.length > 0;
							} )
						);
					} )
					.catch( function () {
						if ( live ) {
							setGroups( false );
						}
					} );

				return function () {
					live = false;
				};
			},
			[ snapshotUrl, reloadKey ]
		);

		return groups;
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

	/**
	 * The live map. Until the block is selected a clear sheet lies over it, so a
	 * click selects the block instead of panning the map — the way core's own
	 * embeds behave. Selected, the map is the owner's to try.
	 */
	function Preview( props ) {
		return el(
			'div',
			{ className: 'pinglide-map__canvas' },
			el( 'iframe', {
				key: props.frameKey,
				src: props.src,
				title: props.title,
				loading: 'lazy',
			} ),
			props.isSelected ? null : el( 'div', { className: 'pinglide-preview-cover', 'aria-hidden': true } )
		);
	}

	function SizePanel( props ) {
		var a = props.attributes;
		var setAttributes = props.setAttributes;
		var fixedWidth = a.align === 'wide' || a.align === 'full';

		return el(
			PanelBody,
			{ title: __( 'Size', 'pinglide' ) },
			el( RangeControl, {
				label: __( 'Height (px)', 'pinglide' ),
				value: a.height,
				min: MIN_HEIGHT,
				max: MAX_HEIGHT,
				step: 10,
				onChange: function ( value ) {
					setAttributes( { height: value || 520 } );
				},
				__nextHasNoMarginBottom: true,
				__next40pxDefaultSize: true,
			} ),
			el( ToggleControl, {
				label: __( 'Different height on phones', 'pinglide' ),
				help: __( 'Phones are screens narrower than 600px. Preview it with the editor’s Mobile view.', 'pinglide' ),
				checked: a.mobileHeight > 0,
				onChange: function ( on ) {
					setAttributes( { mobileHeight: on ? Math.min( a.height, 420 ) : 0 } );
				},
				__nextHasNoMarginBottom: true,
			} ),
			a.mobileHeight > 0
				? el( RangeControl, {
						label: __( 'Height on phones (px)', 'pinglide' ),
						value: a.mobileHeight,
						min: MIN_HEIGHT,
						max: MAX_HEIGHT,
						step: 10,
						onChange: function ( value ) {
							setAttributes( { mobileHeight: value || MIN_HEIGHT } );
						},
						__nextHasNoMarginBottom: true,
						__next40pxDefaultSize: true,
				  } )
				: null,
			fixedWidth
				? el(
						'p',
						{ className: 'pinglide-hint' },
						__( 'Wide and full width maps take the width of the page. Pick another alignment in the toolbar to set a width.', 'pinglide' )
				  )
				: el( RangeControl, {
						label: __( 'Width (%)', 'pinglide' ),
						help: __(
							'Narrower than 100%? Use the toolbar’s alignment to place it left, centre or right — text flows beside a left or right map. Phones always show it full width.',
							'pinglide'
						),
						value: a.width,
						min: MIN_WIDTH,
						max: 100,
						step: 5,
						onChange: function ( value ) {
							setAttributes( { width: value || 100 } );
						},
						__nextHasNoMarginBottom: true,
						__next40pxDefaultSize: true,
				  } )
		);
	}

	function TagsPanel( props ) {
		var groups = props.groups;
		var chosen = props.tags;
		var body;

		if ( groups === null ) {
			body = el( Spinner );
		} else if ( groups === false ) {
			body = el(
				'p',
				{ className: 'pinglide-hint' },
				__( "Couldn't read this map's tags. Check your connection and press Reload preview in the toolbar.", 'pinglide' )
			);
		} else if ( groups.length === 0 ) {
			body = el(
				'p',
				{ className: 'pinglide-hint' },
				__( 'This map has no tags yet. Add tags to your locations on Pinglide and press Publish there, then come back to show only some of them here.', 'pinglide' )
			);
		} else {
			var known = [];
			groups.forEach( function ( group ) {
				group.tags.forEach( function ( tag ) {
					known.push( tag.id );
				} );
			} );

			// A tag deleted on Pinglide is simply dropped the next time a box is ticked.
			var toggle = function ( id, on ) {
				var next = chosen.filter( function ( t ) {
					return t !== id && known.indexOf( t ) !== -1;
				} );
				if ( on ) {
					next.push( id );
				}
				props.onChange( next );
			};

			body = el(
				Fragment,
				null,
				el(
					'p',
					{ className: 'pinglide-hint' },
					__( 'Tick tags to show only the locations wearing one of them. Leave all unticked to show every location.', 'pinglide' )
				),
				groups.map( function ( group ) {
					return el(
						'fieldset',
						{ key: group.id, className: 'pinglide-tag-group' },
						groups.length > 1 || group.label ? el( 'legend', null, group.label ) : null,
						group.tags.map( function ( tag ) {
							return el( CheckboxControl, {
								key: tag.id,
								label: tag.label,
								checked: chosen.indexOf( tag.id ) !== -1,
								onChange: function ( on ) {
									toggle( tag.id, on );
								},
								__nextHasNoMarginBottom: true,
							} );
						} )
					);
				} )
			);
		}

		return el( PanelBody, { title: __( 'Locations shown', 'pinglide' ), initialOpen: false }, body );
	}

	function ConnectedControls( props ) {
		var a = props.attributes;
		var map = props.map;

		return el(
			Fragment,
			null,
			el(
				BlockControls,
				null,
				el(
					ToolbarGroup,
					null,
					el( ToolbarButton, {
						icon: 'update',
						label: __( 'Reload preview', 'pinglide' ),
						onClick: props.onReload,
					} ),
					el( ToolbarButton, {
						icon: 'external',
						label: __( 'Edit locations on Pinglide', 'pinglide' ),
						href: map.editUrl,
						target: '_blank',
						rel: 'noopener',
					} )
				)
			),
			el(
				InspectorControls,
				null,
				el(
					PanelBody,
					{ title: __( 'Map', 'pinglide' ) },
					el( 'p', null, el( 'strong', null, map.name ) ),
					el(
						'p',
						{ className: 'pinglide-hint' },
						__( 'Add and edit locations on Pinglide and press Publish there — this page updates by itself. Press Reload preview in the toolbar to see the change here.', 'pinglide' )
					),
					el(
						'div',
						{ className: 'pinglide-actions' },
						el(
							Button,
							{ variant: 'primary', href: map.editUrl, target: '_blank', rel: 'noopener' },
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
					),
					props.waiting
						? el( 'p', null, el( Spinner ), ' ', __( 'Waiting for Pinglide…', 'pinglide' ) )
						: null
				),
				el( SizePanel, { attributes: a, setAttributes: props.setAttributes } ),
				el( TagsPanel, {
					groups: props.groups,
					tags: a.tags || [],
					onChange: function ( tags ) {
						props.setAttributes( { tags: tags } );
					},
				} ),
				el(
					PanelBody,
					{ title: __( 'Loading', 'pinglide' ), initialOpen: false },
					el( ToggleControl, {
						label: __( 'Load straight away', 'pinglide' ),
						help: __(
							'Maps normally load when they are scrolled near, which keeps the page fast. Turn this on when the map is at the top of the page.',
							'pinglide'
						),
						checked: !! a.eager,
						onChange: function ( on ) {
							props.setAttributes( { eager: on } );
						},
						__nextHasNoMarginBottom: true,
					} )
				)
			)
		);
	}

	function Edit( props ) {
		var attributes = props.attributes;
		var setAttributes = props.setAttributes;
		var slot = attributes.slot;
		// The id the editor gives every block's wrapper; it overrides any id passed to useBlockProps.
		var wrapperId = 'block-' + props.clientId;

		var waitingPair = useState( false );
		var waiting = waitingPair[ 0 ];
		var setWaiting = waitingPair[ 1 ];

		var reloadPair = useState( 0 );
		var reloads = reloadPair[ 0 ];
		var setReloads = reloadPair[ 1 ];

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

		var connectedAt = state && state.connected ? state.map.connectedAt : null;
		useEffect(
			function () {
				setWaiting( false );
			},
			[ connectedAt ]
		);

		var map = state && state.connected ? state.map : null;
		var groups = useTagGroups( map ? map.snapshot : '', reloads );

		var blockProps = useBlockProps();
		var onOpened = function () {
			setWaiting( true );
		};

		if ( ! state ) {
			return el( 'div', blockProps, el( Placeholder, { icon: 'location-alt', label: __( 'Pinglide map', 'pinglide' ) }, el( Spinner ) ) );
		}

		if ( state.failed ) {
			return el(
				'div',
				blockProps,
				el(
					Notice,
					{ status: 'error', isDismissible: false },
					__( "Couldn't check this map's setup. Reload the editor and try again.", 'pinglide' )
				)
			);
		}

		if ( ! map ) {
			return el( 'div', blockProps, el( NotConnected, { connectUrl: state.connectUrl, waiting: waiting, onOpened: onOpened } ) );
		}

		var tags = attributes.tags || [];
		var src = map.previewUrl + ( tags.length ? '&tags=' + encodeURIComponent( tags.join( ',' ) ) : '' );

		return el(
			'div',
			blockProps,
			el( ConnectedControls, {
				attributes: attributes,
				setAttributes: setAttributes,
				map: map,
				groups: groups,
				connectUrl: state.connectUrl,
				waiting: waiting,
				onOpened: onOpened,
				onReload: function () {
					setReloads( reloads + 1 );
				},
			} ),
			el(
				'style',
				null,
				sizeCss( '#' + wrapperId, {
					height: attributes.height || 520,
					mobileHeight: attributes.mobileHeight || 0,
					width: attributes.width || 100,
					align: attributes.align || '',
				} )
			),
			el( Preview, {
				src: src,
				frameKey: map.connectedAt + ':' + reloads,
				title: map.name,
				isSelected: props.isSelected,
			} )
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
