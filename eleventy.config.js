import syntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";
import markdownItAnchor from "markdown-it-anchor";
import markdownItAttrs from "markdown-it-attrs";

const includeDrafts = process.env.DRAFTS === "true";

/** @param {import("@11ty/eleventy").UserConfig} eleventyConfig */
export default (eleventyConfig) => {
  eleventyConfig.addPlugin(syntaxHighlight)
  eleventyConfig.amendLibrary("md", mdLib => mdLib
    .use(markdownItAnchor, {
      tabIndex: false,
      slugify(str) {
        // mimick CommonMarkGhPages: https://github.com/github/jekyll-commonmark-ghpages/blob/17d4ffe88aa976e82dce5bd686bc85717601a37a/lib/jekyll-commonmark-ghpages.rb#L61-L78
        return str.replace(/^[^a-zA-Z]+/, "").replaceAll(/[^a-zA-Z0-9 -]/g, "").replaceAll(" ", "-").toLowerCase() || "section";
      }
    })
    .use(markdownItAttrs));
  eleventyConfig.addCollection("posts", collectionApi => {
    return collectionApi.getFilteredByGlob([
      "_posts/*",
      ...(includeDrafts ? ["_drafts/*"] : []),
    ]).filter(p => p.data.published !== false).reverse();
  });
  if (!includeDrafts) {
    eleventyConfig.ignores.add("_drafts");
  }
  eleventyConfig.addPassthroughCopy("googlea7c46ecf2eaab4db.html")
  eleventyConfig.ignores.add("googlea7c46ecf2eaab4db.html");
  eleventyConfig.addPassthroughCopy("image");
  eleventyConfig.addPassthroughCopy("js");
  eleventyConfig.addPassthroughCopy("wordle-elements");
  eleventyConfig.ignores.add("wordle-elements");
  eleventyConfig.addExtension("css", { key: "liquid" });
  eleventyConfig.addExtension("xml", { key: "liquid" });
  eleventyConfig.addTemplateFormats("css,xml");
  eleventyConfig.addLiquidTag("post_url", function () {
    return {
      parse(tagToken) {
        // escaping taken from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
        this.re = new RegExp(`/${tagToken.args.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.\\w+$`);
      },
      *render(ctx) {
        return ctx.environments.collections.posts.find(post => this.re.test(post.page.inputPath))?.page.url;
      },
    };
  });
  eleventyConfig.addPairedShortcode("pullquote", function (content, ...additionalRoles) {
    return `<aside role="${["doc-pullquote", ...additionalRoles].join(" ")}"${additionalRoles.includes("presentation") ? " aria-hidden=true" : ""}>${content}</aside>`;
  });
  eleventyConfig.setLiquidParameterParsing("builtin");
  return {
    dir: {
      layouts: "_layouts",
    },
  };
};
