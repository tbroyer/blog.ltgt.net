module.exports = {
  date: "Last Modified",
  layout: "post",
  eleventyComputed: {
    title: (data) => data.title || data.page.fileSlug
  }
}
