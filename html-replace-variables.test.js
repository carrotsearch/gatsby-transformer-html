const replaceVariables = require("./html-replace-variables.js");
require("must/register");

describe("replaceVariables", function () {
  it("must not fail when undefined variables object is passed", function () {
    const input = "input";
    const replaced = replaceVariables(input, undefined);

    replaced.must.equal(input);
  });

  it("must not allow special characters in variable names", function () {
    let exception;
    try {
      replaceVariables("", {
        "NAME_OK": "",
        "%NOT_OK%": "",
        "SPECIAL$": ""
      });
    } catch (e) {
      exception = e;
    }

    exception.must.not.be.undefined();
    exception.must.contain("%NOT_OK%");
    exception.must.contain("SPECIAL");
    exception.must.not.contain("NAME_OK");
  });

  it("must make individual replacements", function () {
    const input = "Something %to_replace%";
    const replaced = replaceVariables(input, {
      "to_replace": "to replace"
    });

    replaced.must.be.equal("Something to replace");
  });


  it("must make multiple replacements", function () {
    const input = "%sth% %to_replace%%00%with%00%%sth%";
    const replaced = replaceVariables(input, {
      "sth": "something",
      "to_replace": "to replace",
      "00": " "
    });

    replaced.must.be.equal("something to replace with something");
  });
});