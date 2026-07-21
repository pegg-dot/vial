import { describe, expect, it } from "vitest";
import { toCsv } from "@/server/api-access/csv";

describe("CSV export serializer", () => {
  it("emits a header row then data rows", () => {
    expect(toCsv([{ slug: "bpc-157", price: 54 }], ["slug", "price"])).toBe("slug,price\r\nbpc-157,54\r\n");
  });
  it("escapes commas, quotes, and newlines per RFC 4180", () => {
    const csv = toCsv([{ a: "x,y", b: 'he said "hi"', c: "line1\nline2" }], ["a", "b", "c"]);
    expect(csv).toBe('a,b,c\r\n"x,y","he said ""hi""","line1\nline2"\r\n');
  });
  it("renders numbers/booleans/null/undefined safely", () => {
    expect(toCsv([{ a: 1, b: true, c: null, d: undefined }], ["a", "b", "c", "d"])).toBe("a,b,c,d\r\n1,true,,\r\n");
  });

  it("neutralizes spreadsheet formula injection in text cells", () => {
    // A cell beginning with =, +, -, @, tab, or CR gets a leading apostrophe so
    // Excel/Sheets treat it as text, not an executable formula.
    expect(toCsv([{ a: "+SUM(A1)" }, { a: "@x" }, { a: "-cmd" }], ["a"])).toBe("a\r\n'+SUM(A1)\r\n'@x\r\n'-cmd\r\n");
    expect(toCsv([{ a: '=HYPERLINK("http://evil")' }], ["a"])).toBe('a\r\n"\'=HYPERLINK(""http://evil"")"\r\n');
  });

  it("leaves genuine numbers (including negatives) untouched", () => {
    // Only attacker-controllable text is neutralized; a real -5 stays a number.
    expect(toCsv([{ a: -5, b: 3.14 }], ["a", "b"])).toBe("a,b\r\n-5,3.14\r\n");
  });
});
