const { removeCommonIndent } = require("./remove-common-indent.js");
require("must/register");

describe("removeCommonIndent", function () {
  it("must not fail on undefined input", function () {
    const result = removeCommonIndent(undefined);
    result.must.equal("");
  });

  it("must not remove indent when some line starts with a non-space", function () {
    const input = `
no indent
 indent`;

    const result = removeCommonIndent(input);
    result.must.equal(input)
  });

  it("must correctly remove space-based indent", function () {
    const input = `no indent
 indent`;

    const result = removeCommonIndent(input);
    result.must.equal(`no indent
 indent`)
  });

  it("must correctly remove tab-based indent", function () {
    const input = `\tno indent
\t\tindent`;

    const result = removeCommonIndent(input);
    result.must.equal(`no indent
\tindent`)
  });

  it("must ignore empty lines when computing indent size", function () {
    const input = `
  no indent
    indent`;

    const result = removeCommonIndent(input);
    result.must.equal(`
no indent
  indent`)
  });

  it("must ignore blank lines when computing indent size", function () {
    const input = ` 
    no indent
      indent`;

    const result = removeCommonIndent(input);
    result.must.equal(`
no indent
  indent`)
  });

  it("must preserve empty and blank lines", function () {
    const input = `
    indent


      indent
      
    indent`;

    const result = removeCommonIndent(input);
    result.must.equal(`
indent


  indent
  
indent`)
  })
});