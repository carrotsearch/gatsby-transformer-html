This repository is deprecated. The most up-to-date code is now at [@carrotsearch/gatsby-theme-apidocs](https://github.com/carrotsearch/gatsby-theme-apidocs/tree/master/plugins/gatsby-plugin-transformer-html).

---

A Gatsby transformer plugin for authoring content in HTML, part of
[`gatsby-starter-apidocs`](https://github.com/carrotsearch/gatsby-starter-apidocs).

---

One functional area of the plugin is enriching raw HTML content by:

* rewriting local links to point to the generated Gatsby pages,

* adding section anchor links,

* processing linked images into multi-resolution responsive img tags,

* applying Prism.js highlighting to code blocks,

* embedding code examples from external files,

* adding synthetic identifiers to paragraph to make it possible to link to them from content search results.

Another functional area of the plugin is extracting paragraph-sized text snippets from the page, so that they can be indexed in the client-side text search implemented by the [`gatsby-plugin-content-search`](https://github.com/carrotsearch/gatsby-plugin-content-search) plugin.

The enriched HTML and lists of extracted text snippets are available in Gatsby's GraphQL model for use by other plugins.

