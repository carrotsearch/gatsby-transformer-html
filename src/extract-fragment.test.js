const extractFragments = require("./extract-fragment.js");
const demand = require("must/register");

describe("extractFragments", function () {
  it("must not fail when input is undefined", function () {
    const fragment = extractFragments(undefined, "fragment1");
    fragment.must.equal("");
  });

  it("must fail when fragment is not closed", function () {
    const input = `// fragment-start{fragment1}
included
`;

    let exception;
    try {
      extractFragments(input, "fragment1");
    } catch (e) {
      exception = e;
    }

    demand(exception).not.be.undefined();
    exception.must.contain("End marker for fragment fragment1 not found.");
  });

  it("must fail when fragment is not open", function () {
    const input = `// fragment-end{fragment1}
included
`;

    let exception;
    try {
      extractFragments(input, "fragment1");
    } catch (e) {
      exception = e;
    }

    demand(exception).not.be.undefined();
    exception.must.contain("Expecting start of fragment marker for fragment1, found end of fragment marker.");
  });

  it("must fail when fragment is not present", function () {
    const input = `// fragment-start{fragment0}
included
// fragment-end{fragment0}
`;

    let exception;
    try {
      extractFragments(input, "fragment1");
    } catch (e) {
      exception = e;
    }

    demand(exception).not.be.undefined();
    exception.must.contain("Fragment fragment1 not found.");
  });

  it("must correctly extract one-fragment fragment", function () {
    const input = `not included
// fragment-start{fragment1}
included
// fragment-end{fragment1}
not included    
`;

    const fragment = extractFragments(input, "fragment1");
    fragment.must.equal("included");
  });

  it("must correctly extract multi-fragment fragment", function () {
    const input = `not included
// fragment-start{fragment1}
included
// fragment-end{fragment1}
not included    
// fragment-start{fragment1}
included
// fragment-end{fragment1}
`;

    const fragment = extractFragments(input, "fragment1");
    fragment.must.equal("included\nincluded");
  });

  it("must omit lines with fragment markers", function () {
    const input = `not included
// fragment-start{fragment1}
// fragment-end{yet-another}
included
// fragment-start{other}
// fragment-end{fragment1}
not included    
`;

    const fragment = extractFragments(input, "fragment1");
    fragment.must.equal("included");
  });

  it("must preserve empty and blank lines", function () {
    const input = `not included
// fragment-start{fragment1}
included

   
after blank
// fragment-end{fragment1}
not included    
`;

    const fragment = extractFragments(input, "fragment1");
    fragment.must.equal(`included

   
after blank`);
  });
});