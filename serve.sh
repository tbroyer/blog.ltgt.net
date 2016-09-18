docker run --rm -v "$PWD":/srv/jekyll -p "4000:4000" -e DRAFTS=true jekyll/jekyll:pages
