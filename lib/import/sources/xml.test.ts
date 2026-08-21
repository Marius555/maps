/**
 * @vitest-environment jsdom
 *
 * The XML source uses the browser's own DOMParser, which Node doesn't have. jsdom
 * rather than happy-dom because happy-dom's XML parser rejects CDATA outright,
 * and store-locator feeds wrap names and descriptions in it constantly — a test
 * environment that can't read those can't tell us whether we can either.
 */

import { describe, expect, it } from "vitest";

import { buildTable } from "../table";
import { readXmlText } from "./xml";
import { ImportSourceError } from "./types";

/** XML text straight through to the table the mapping step sees. */
function table(xml: string) {
  return buildTable(readXmlText(xml, "test.xml"));
}

describe("readXmlText", () => {
  it("finds the repeating element and makes a row of each", () => {
    const result = table(`
      <stores>
        <store><name>Alpha</name><city>Berlin</city></store>
        <store><name>Beta</name><city>Hamburg</city></store>
        <store><name>Gamma</name><city>Köln</city></store>
      </stores>
    `);

    expect(result.headers).toEqual(["name", "city"]);
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]).toEqual({ name: "Alpha", city: "Berlin" });
  });

  it("works whatever the elements are called", () => {
    // There is no schema to rely on — the repeating element is the only thing
    // every store-locator feed has in common.
    const result = table(`
      <root>
        <item><title>Alpha</title><town>Berlin</town></item>
        <item><title>Beta</title><town>Hamburg</town></item>
      </root>
    `);

    expect(result.headers).toEqual(["title", "town"]);
    expect(result.rows).toHaveLength(2);
  });

  it("flattens nested elements into dotted columns", () => {
    const result = table(`
      <stores>
        <store>
          <name>Alpha</name>
          <address><street>Torstr. 1</street><city>Berlin</city></address>
        </store>
        <store>
          <name>Beta</name>
          <address><street>Hafenweg 9</street><city>Hamburg</city></address>
        </store>
      </stores>
    `);

    expect(result.headers).toEqual(["name", "address.street", "address.city"]);
    expect(result.rows[0]["address.street"]).toBe("Torstr. 1");
  });

  it("turns attributes into columns", () => {
    const result = table(`
      <stores>
        <store id="1" type="flagship"><name>Alpha</name></store>
        <store id="2" type="outlet"><name>Beta</name></store>
      </stores>
    `);

    expect(result.headers).toContain("@id");
    expect(result.headers).toContain("@type");
    expect(result.rows[0]["@type"]).toBe("flagship");
  });

  it("joins repeated children instead of keeping only the last", () => {
    const result = table(`
      <stores>
        <store><name>Alpha</name><phone>111</phone><phone>222</phone></store>
        <store><name>Beta</name><phone>333</phone></store>
      </stores>
    `);

    expect(result.rows[0].phone).toBe("111, 222");
  });

  it("lines up records with different fields", () => {
    // The union of keys is the header, so a record missing a field leaves a gap
    // rather than shifting every later column.
    const result = table(`
      <stores>
        <store><name>Alpha</name><city>Berlin</city></store>
        <store><name>Beta</name><phone>333</phone></store>
      </stores>
    `);

    expect(result.headers).toEqual(["name", "city", "phone"]);
    expect(result.rows[1]).toEqual({ name: "Beta", city: "", phone: "333" });
  });

  it("handles namespaced documents", () => {
    const result = table(`
      <s:stores xmlns:s="http://example.com/stores">
        <s:store><s:name>Alpha</s:name><s:city>Berlin</s:city></s:store>
        <s:store><s:name>Beta</s:name><s:city>Hamburg</s:city></s:store>
      </s:stores>
    `);

    expect(result.headers).toEqual(["name", "city"]);
    expect(result.rows).toHaveLength(2);
  });

  it("reads CDATA as text", () => {
    const result = table(`
      <stores>
        <store><name><![CDATA[Alpha & Co]]></name><city>Berlin</city></store>
        <store><name>Beta</name><city>Hamburg</city></store>
      </stores>
    `);

    expect(result.rows[0].name).toBe("Alpha & Co");
  });

  it("refuses malformed XML with a message rather than a crash", () => {
    expect(() => table("<stores><store></stores>")).toThrow(ImportSourceError);
  });

  it("refuses a document with nothing repeating in it", () => {
    expect(() => table("<config><setting>on</setting></config>")).toThrow(
      /repeating element/,
    );
  });
});
