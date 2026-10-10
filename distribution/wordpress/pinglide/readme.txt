=== Pinglide Maps ===
Contributors: pinglide
Tags: map, store locator, locations, stockists, dealers
Requires at least: 6.5
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 0.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Put your stores, stockists or venues on a map. Set it up once — no API key, no code — and your page updates whenever you change the map.

== Description ==

Pinglide Maps adds a **Pinglide map** block to the editor.

1. Add the block to any page.
2. Press **Set up this map**. Create a free Pinglide account (or log in) and choose a map.
3. You're sent back to WordPress, and the map is on your page.

Add, import and style your locations on Pinglide — import a spreadsheet, colour pins by tag, design the popup card — and press Publish there. Your WordPress page shows the change by itself. There is nothing to copy or paste, and no API key to manage.

Visitors get a fast map with clustering, search, tag filters and "find nearest". Maps load only when scrolled into view, and there is no per-view charge.

Using the classic editor or a page builder (Elementor, Divi, Beaver Builder)? Go to **Settings → Pinglide**, press **Connect a new map**, and paste the shortcode it gives you.

== External services ==

This plugin connects to Pinglide (https://pinglide.com), the service where your maps and locations are stored and edited.

* **When you press "Set up this map" or "Connect a new map"**, your browser opens pinglide.com with your site's address, its name, and a one-time security token, so Pinglide can send you back to this site with the map you chose. Nothing is sent from your server.
* **When a visitor views a page with a map**, their browser loads the map script and the map's published data from Pinglide's CDN (cdn.pinglide.com). Map tiles come from OpenFreeMap (https://openfreemap.org) with OpenStreetMap data. If you switch on visitor statistics for a map on Pinglide, the browser also sends Pinglide one summary per visit: what was searched for and opened on the map, the page address, and the visitor's IP address and approximate location. It is off unless you switch it on.

Pinglide terms of service: https://pinglide.com/terms
Pinglide privacy policy: https://pinglide.com/privacy

== Frequently Asked Questions ==

= Do I need an API key? =

No. The set-up button links this block to your Pinglide map; there is nothing to copy.

= Can I have several maps on one site? =

Yes. Every block is set up on its own and shows its own map.

= What happens if I deactivate the plugin? =

The maps disappear from your pages, and come back when you reactivate it. Deleting the plugin forgets which map each block showed; your maps stay in your Pinglide account.

== Changelog ==

= 0.1.0 =
* First release: the Pinglide map block, the shortcode, and one-click set up.
