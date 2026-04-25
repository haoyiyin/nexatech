import { describe, expect, it } from "vitest";
import { htmlToPlainText } from "./sanitize-message";

describe("htmlToPlainText", () => {
  it("decodes common named entities", () => {
    expect(htmlToPlainText("Hello &quot;World&quot; &amp; everyone&#39;s here.")).toBe(
      'Hello "World" & everyone\'s here.'
    );
  });

  it("decodes numeric decimal and hex entities", () => {
    expect(htmlToPlainText("&#72;&#101;&#108;&#108;&#111; &#x57;&#x6F;&#x72;&#x6C;&#x64;"))
      .toBe("Hello World");
  });

  it("strips tags while preserving paragraph breaks", () => {
    expect(htmlToPlainText("<div>Hello<br><br><p>World</p><ul><li>One</li><li>Two</li></ul></div>"))
      .toBe("Hello\n\nWorld\nOne\nTwo");
  });

  it("removes script and style contents entirely", () => {
    expect(
      htmlToPlainText(
        '<div>Hello</div><script>\nalert("xss");\n</script><style>.hidden { display: none; }</style><p>World</p>'
      )
    ).toBe("Hello\nWorld");
  });

  it("removes unclosed script and style blocks with their trailing contents", () => {
    expect(htmlToPlainText('<div>Hello</div><script>\nalert("xss");\n<p>World</p>')).toBe(
      "Hello"
    );
    expect(
      htmlToPlainText('<div>Hello</div><style>\n.hidden { display: none; }\n<p>World</p>')
    ).toBe("Hello");
  });

  it("strips tags with quoted angle brackets in attributes", () => {
    expect(htmlToPlainText('<div data-preview="1 > 0">Hello<br title="a > b">World</div>')).toBe(
      "Hello\nWorld"
    );
  });

  it("keeps entity-encoded tags as text after decoding", () => {
    expect(htmlToPlainText("&lt;script&gt;alert(1)&lt;/script&gt;")).toBe(
      "<script>alert(1)</script>"
    );
  });

  it("preserves literal line break marker text from the message body", () => {
    expect(htmlToPlainText("Use __LINE_BREAK__ for parsing<br>Done")).toBe(
      "Use __LINE_BREAK__ for parsing\nDone"
    );
  });

  it("returns empty text for blank input", () => {
    expect(htmlToPlainText(null)).toBe("");
    expect(htmlToPlainText(undefined)).toBe("");
    expect(htmlToPlainText("")).toBe("");
    expect(htmlToPlainText("   ")).toBe("");
  });

  it("leaves unknown entities untouched", () => {
    expect(htmlToPlainText("Hello &unknown; entity")).toBe("Hello &unknown; entity");
  });
});
