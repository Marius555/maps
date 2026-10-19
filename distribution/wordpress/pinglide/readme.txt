=== Pinglide ===
Contributors: marius536
Tags: map, store locator, locations, stockists, dealers
Requires at least: 6.5
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 0.2.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Put your stores, stockists or venues on a map. Set it up once — no API key, no code — and your page updates whenever you change the map.

== Description ==

Pinglide adds a **Pinglide map** block to the editor.

1. Add the block to any page.
2. Press **Set up this map**. Create a free Pinglide account (or log in) and choose a map.
3. You're sent back to WordPress, and the map is on your page.

Add, import and style your locations on Pinglide — import a spreadsheet, colour pins by tag, design the popup card — and press Publish there. Your WordPress page shows the change by itself. There is nothing to copy or paste, and no API key to manage.

Visitors get a fast map with clustering, search, tag filters and "find nearest". Maps load only when scrolled into view, and there is no per-view charge.

**You decide where it goes and how big it is**, with no code:

* **See the real map in the editor**, at the size it will be on the page.
* **Height**, and a **different height on phones**. Check it with the editor's Mobile preview.
* **Width and alignment.** Place a narrower map left, centre or right with text flowing beside it, or make it wide or full width.
* **Margins, rounded corners and a shadow**, from the block's own style controls.
* **Show only some locations.** Tick tags to put one Pinglide map on several pages, for example only dealers on one and only shops on another.
* **Create a page with this map**: one click on Settings → Pinglide makes a draft page with the map already on it.

**Elementor**: a native **Pinglide map** widget, with responsive height, width, alignment and corner controls, a tag filter and a live preview. Connect a map once on **Settings → Pinglide** and pick it from the widget.

**Classic editor and other page builders** (Divi, Beaver Builder): go to **Settings → Pinglide**, press **Connect a new map**, and copy the shortcode it gives you. Size it with `height`, `mobile_height`, `width` and `align`, all listed on that page.

== External services ==

This plugin connects to Pinglide (https://pinglide.com), the service where your maps and locations are stored and edited.

* **When you press "Set up this map" or "Connect a new map"**, your browser opens pinglide.com with your site's address, its name, and a one-time security token, so Pinglide can send you back to this site with the map you chose. Nothing is sent from your server.
* **When you build a page in Elementor**, your server reads the chosen map's published data from Pinglide's CDN (cdn.pinglide.com) to list its tags in the widget's settings. This only happens in the Elementor editor, never when a visitor views a page, and is cached for ten minutes.
* **When a visitor views a page with a map**, their browser loads the map script and the map's published data from Pinglide's CDN (cdn.pinglide.com). Map tiles come from OpenFreeMap (https://openfreemap.org) with OpenStreetMap data. If you switch on visitor statistics for a map on Pinglide, the browser also sends Pinglide one summary per visit: what was searched for and opened on the map, the page address, and the visitor's IP address and approximate location. It is off unless you switch it on.

Pinglide terms of service: https://pinglide.com/terms
Pinglide privacy policy: https://pinglide.com/privacy

== Frequently Asked Questions ==

= Do I need an API key? =

No. The set-up button links this block to your Pinglide map; there is nothing to copy.

= Can I have several maps on one site? =

Yes. Every block is set up on its own and shows its own map.

= Can I change the size of the map, or put it beside some text? =

Yes. Select the block and use its sidebar: height, a different height on phones, and width. The toolbar's alignment buttons put a narrower map left, centre or right, with text flowing beside it. For a map and text side by side on every screen size, put the block in a Columns block. In Elementor, the widget has the same controls per device.

= Can one map show different locations on different pages? =

Yes. In the block's **Locations shown** panel (or the Elementor widget's tag setting), tick the tags to show. Locations without any of those tags are hidden on that page only.

= Does the map in the editor count as a visit in my statistics? =

No. Pinglide leaves out maps viewed in the WordPress editor.

= What happens if I deactivate the plugin? =

The maps disappear from your pages, and come back when you reactivate it. Deleting the plugin forgets which map each block showed; your maps stay in your Pinglide account.

== Changelog ==

= 0.2.0 =
* The block shows the live map in the editor, at its real size.
* Size controls: height, a separate height on phones, width, alignment left/centre/right/wide/full, margins, rounded corners and shadow.
* Show only some locations on a page, by tag.
* "Load straight away" for a map at the top of a page.
* Settings → Pinglide: copy a shortcode in one click, and create a page with a map already on it.
* The shortcode takes `mobile_height`, `width`, `align`, `tags` and `eager`.
* A native Elementor widget.

= 0.1.0 =
* First release: the Pinglide map block, the shortcode, and one-click set up.
