---
layout: post
title: Migrating from Jekyll to Eleventy
discuss_url: https://dev.to/tbroyer/migrating-from-jekyll-to-eleventy-1g50
---

Yes, this is going to be yet another one of those articles explaining how I migrated this blog from [Jekyll](https://jekyllrb.com/) to [Eleventy](https://11ty.dev/). You've been warned.

## Why?

I don't really have issues with Jekyll and I've been using it for 10 years now here, but I haven't really _chosen_ Jekyll: it's been more-or-less imposed on me by GitHub Pages.
But GitHub now has added the possibility to [deploy using a custom GitHub Actions workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#publishing-with-a-custom-github-actions-workflow), and this is game-changer!

I could have kept using Jekyll with unlocked possibilities, but I'm not a Rubyist, that's just not a language I'm comfortable with, and I know almost nothing about Gems, so definitely not something I'd be comfortable maintaining going forward.

I also could have just kept using the built-in Jekyll Pages integration, and this is what I would have done if I hadn't found any satisfying alternative. I'm not forced to change, so at least I have a fallback in the form of the _status quo_.

So what would replace it? Let's evaluate my requirements.

### The Requirements

* I have articles written in HTML (exports from Posterous) and Markdown, using a bit of Liquid to link to other articles (with the `post_url` Jekyll tag). The Markdown articles use [GitHub Flavored Markdown](https://github.github.com/gfm/), including syntax-highlighted fenced code blocks, with embedded HTML. Ideally I shouldn't have to update the articles at all.
* I only have 4 templates only (`index.html`, `rss.xml`, and `default` and `post` layouts) so migrating to another templating engine wouldn't really be a problem. The `index.html` uses pagination (even though I still only have a single page). The `default` layout builds a [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) using flags from the articles' front matter.
* I also have a few static files: CSS, JS, and images (and a file to [verify ownership](https://support.google.com/webmasters/answer/9008080?hl=en#html_verification) for the Google Search Console).
* Of course, because [cool URIs don't change](https://www.w3.org/Provider/Style/URI), the permalinks have to be ported to the new solution.
* I hadn't identified it at first, but I actually have an old article that's not published, through Jekyll's `published: false` in the front matter. In the worst case, I'd just delete it (it'd still be there in the Git history).
* Nice to have: I kinda like Jekyll's `_drafts` folder using the file's last modified date, and `_posts` folder with the publication date as part of the file name. (I don't commit my drafts, and yes that means I don't have backups; I don't have many drafts, and I'll probably never finish and publish them so 🤷)
* Of course I want something I'm comfortable using for the next 10 years, in terms of technology and ecosystem. This means essentially that I'd like a Node-based solution.
* Last, but not least, I want the output to be (almost) identical (for now at least) to the Jekyll site: must be static HTML, with `<script>`s added by the layouts and possibly right from the articles, no _client-side hydration_ and upgrading to a Single Page Application.

### The choice

The _HTML-first_ approach rules out (_a priori_, correct me if I'm wrong) every React or Vue based approach, or similar.

I've quickly evaluated a couple alternatives, namely [Astro](https://astro.build/) and Eleventy.

Astro is fun, but I must say it doesn't really look _content oriented_, relegating the content into its `src/pages`, or worse, a subfolder inside `src/content/`.
I really like the typesafe nature of content collections, but moving everything down to `src/content/blog` really _hides_ the content away IMO.
Extracting the publication date from the file name [is possible](https://github.com/humanwhocodes/astro-jekyll), but it looks more and more like a _development_ project rather than a _content_ project.
It's great, but not what I'm looking for here.

I then looked at Eleventy. I have to admit my first contacts with the Eleventy documentation months ago left me with a bitter taste as I couldn't really figure out how collections worked and how you were supposed (or not) to organize your files. Looking at [tweetback](https://github.com/tweetback/tweetback) more recently didn't really help: absolutely everything is JS, loading content from a SQLite database.

I decided to give it a chance: maybe I misunderstood the documentation the last time(s) I read it.
And indeed it was the case: moving from Jekyll to Eleventy probably couldn't be easier.

## How?

I felt my way a bit, so I'll summarize here [what I ended up doing](https://github.com/tbroyer/blog.ltgt.net/commit/1baabc320ebefbbbaae2e37c6beeceed2c2167cf), also describing some things I tried along the way.

### Getting Started

Removing Jekyll consists in deleting the `_config.yml` and possibly `Gemfile` (I didn't have one).
Adding Eleventy means initializing a new NPM packaging and adding the `@11ty/eleventy` dependency (and of course adding `node_modules` to the `.gitignore`), and creating a [configuration file](https://www.11ty.dev/docs/config/#default-filenames) (I chose `eleventy.config.cjs` rather than the `.eleventy.js` hidden file).

Because the deployment workflow is different, the `CNAME` file becomes useless and can be deleted.
A new GitHub Actions workflow also has to be created, using the `actions/configure-pages`, `actions/upload-pages-artifact`, and `actions/deploy-pages` actions. I took inspiration from [the Astro starter workflow](https://github.com/actions/starter-workflows/blob/main/pages/astro.yml) and updated it for Eleventy.

### Markdown

Eleventy supports Markdown out of the box, with all the options I needed, except syntax highlighting and heading anchors for deep linking.
It also automatically [extracts the date from the file name](https://www.11ty.dev/docs/dates/).

Syntax highlighting is as easy as using [the official plugin](https://www.11ty.dev/docs/plugins/syntaxhighlight/), but then the generated HTML markup is different than with the Rouge highlighter in Jekyll, so I had to change the CSS accordingly.
I ended up importing an existing theme: display would be slightly different than before, but actually probably better looking.

Deep linking requires using [the `markdown-it-anchor` plugin](https://github.com/valeriangalliat/markdown-it-anchor), and to make sure existing deep links wouldn't break I provided my own `slugify` function mimicking the way CommonMarkGhPages computes the slug from the heading text (I happen to have a few headings with `<code>` in them, and CommonMarkGhPages would compute the slug from the rendered HTML leading to things like `codejavaccode`; I chose to break those few links in favor of better-looking anchor slugs).
I also disabled `tabIndex` to keep the same rendering as previously (I'll read more on the accessibility implications and possibly revert that choice later.)

I reimplemented the `post_url` first as a [custom short code](https://www.11ty.dev/docs/shortcodes/) but that meant updating all articles to quote the argument (due to how Eleventy wires things up), so I ended up using a [custom tag](https://www.11ty.dev/docs/custom-tags/); that's specific to the Liquid template engine (in case I would want to change later on) but at least I don't have to update the articles.

In terms of rendering, besides syntax highlighting, the only difference is the `<br>` which are now rendered that way rather than `<br />` (there's an option in `markdown-it` but I'll keep the less XHTML-y, more HTML-y syntax).

The `rss.xml` file wouldn't be treated as a template by default, so I [aliased the `xml` extension](https://www.11ty.dev/docs/languages/custom/#aliasing-an-existing-template-language) to the Liquid engine, and added an explicit `permalink:` to avoid Eleventy creating an `rss.xml/index.html` file.
I did the same with the `css` extension so I could [use an `include`](https://www.11ty.dev/docs/languages/liquid/#supported-features) to bring in the syntax-highlighting theme in my `style.css`.

### Liquid Templating

I had to rename my layout files to use a `.liquid` extension rather than `.html`.
I didn't want to move them though, so I [configured a layouts directory](https://www.11ty.dev/docs/config/#directory-for-layouts-(optional)) instead.

I also had to handle all the Jekyll-specific things I was using: `xml_escape`, `date_to_xmlschema`, `date_to_string`, and `date_to_long_string` filters, and the `site.time` and `site.github.url` variables (we already handled the `post_url` tag above).

At first, I tried to recreate them in Eleventy (which is easy with [custom shortcodes](https://www.11ty.dev/docs/shortcodes/) and [global data files](https://www.11ty.dev/docs/data-global/)), but finally decided that I could replace most with more standard Liquid that would be compatible right-away with LiquidJS: `xml_escape` becomes `escape`, `date_*` become `date:` with the appropriate format (this made it possible to fix my `<time>` elements erroneously including the time), and `site.time` becomes `"now"` or `"today"` with the `date` filter.
I put that in a separate commit as that's compatible with Jekyll Liquid as well.
And all that's left is therefore `site.github.url` that can be put in a global data file (a JS file getting the value out of an environment variable, fed by the `actions/configure-pages` output in the GitHub Actions workflow).

Finally, I actually had to update all templates to use Eleventy's way of [handling pagination](https://www.11ty.dev/docs/pagination/), and looping over collections.

Speaking of collections, I initially used [directory data files](https://www.11ty.dev/docs/data-template-dir/) to assign a `post` tag to all posts in `_posts` and `_drafts`.
This didn't handle the `published: false`, so I used a [custom collection](https://www.11ty.dev/docs/collections/#advanced-custom-filtering-and-sorting) in the configuration file instead.
I probably could have also used a [computed](https://www.11ty.dev/docs/data-computed/) [`eleventyExcludeFromCollections`](https://www.11ty.dev/docs/collections/#how-to-exclude-content-from-collections) to exclude it, but this also helped fix an issue with the sort order and apparently a bug in LiquidJS's `for` loop with both `reversed` and `limit:` where it would limit before reversing whichever way I wrote things, contrary to [what the doc says](https://liquidjs.com/tags/for.html#reversed).

One last change I made: update the Content Security Policy to account for the Eleventy dev mode autoreload; I used `eleventy.env.runMode != "build"` to [detect when run with autoreload](https://www.11ty.dev/docs/data-eleventy-supplied/#eleventy-variable).

### Static Files

Contrary to Jekyll where any file without front matter is simply copied, static files have to be [explicitly declared](https://www.11ty.dev/docs/copy/) with Eleventy.
I also had to [ignore](https://www.11ty.dev/docs/ignores/) those HTML files I needed to just copy without processing.

### Permalinks

Permalinks for the `rss.xml` and `style.css` are defined right in those files' front matter.
The `index.html` uses pagination so I [declared a mapping](https://www.11ty.dev/docs/pagination/#remapping-with-permalinks) there as well.

Finally I decided to compute the permalink for posts right in the front matter of the `post` layout, using the `page.fileSlug` gives me exactly what I want (the date part has already been removed by Eleventy).
Using a JS front matter allowed me to filter out the `published: false` article so it [wouldn't ever be rendered to disk](https://www.11ty.dev/docs/permalinks/#skip-writing-to-the-file-system) (I already excluded it from the `posts` collection, but Eleventy would still process and render it).

### Drafts

To handle drafts, I'm using [the `getFilteredByGlob` function](https://www.11ty.dev/docs/collections/#getfilteredbyglob(-glob-)) when declaring the `posts` collection, so I can decide whether to include the `_drafts` folder depending on an environment variable.
This would include  the drafts in the `posts` collection so they would appear in the `index.html` and `rss.xml`.

More importantly though, when not including drafts, I have to ignore the `_drafts` folder, otherwise the drafts are still processed and generated (despite not being linked to as they don't appear in the `posts` collection).
This is actually not really a problem given that I don't commit drafts to my Git repository, so I would observe this behavior only locally.

### Comparing the results

To make sure the output was identical to the Jekyll-based version, I built the site once with Jekyll before any modification and backed up the `_site` folder; then [compared it](https://meldmerge.org/) with the output of Eleventy to make sure everything was OK.

## Conclusion

As I felt my way and learned about Eleventy, this took me nearly two weekends to complete (not full time, don't worry!)
What took me the most time actually was probably finding (and deciding on) the new syntax-highlighting theme!
Otherwise, things went really smoothly.

I'm very happy with the outcome, so I switched over.
And now that I control the build workflow, I know I could setup an asset pipeline, minify the generated HTML, bring in [more Eleventy plugins](https://github.com/11ty/eleventy-plugin-bundle) to split the syntax-highlighting theme out and [only send it when there's a code block](https://piaille.fr/@tbroyer/109988938746853236) on the page, etc.

A big **would recommend!**
