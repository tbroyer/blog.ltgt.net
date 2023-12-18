export default {
  date: "Last Modified",
  layout: "post",
  eleventyComputed: {
    title: (data) => data.title || data.page.fileSlug
  }
}
