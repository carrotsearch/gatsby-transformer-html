const { removeLeadingAndTrailingNewlines } = require("./remove-leading-and-trailing-newlines.js");
require("must/register");

describe("removeLeadingAndTrailingNewlines", function () {
  it("must not fail on undefined input", function () {
    const result = removeLeadingAndTrailingNewlines(undefined);
    result.must.equal("");
  });

  it("must remove leading new lines", function () {
    const input = `

// test`;
    const result = removeLeadingAndTrailingNewlines(input);
    result.must.equal("// test");
  });

  it("must remove trailing new lines", function () {
    const input = `// test

`;
    const result = removeLeadingAndTrailingNewlines(input);
    result.must.equal("// test");
  });

  it("must remove leading and  trailing new lines", function () {
    const input = `

// test

`;
    const result = removeLeadingAndTrailingNewlines(input);
    result.must.equal("// test");
  });

  it("must not remove leading space", function () {
    const input = `

  // test

`;
    const result = removeLeadingAndTrailingNewlines(input);
    result.must.equal("  // test");
  });
});