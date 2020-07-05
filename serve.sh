docker run --rm -it -v "$PWD":/srv/jekyll -p "4000:4000" -p "35729:35729" -e DRAFTS=true jekyll/jekyll:pages jekyll serve "$@"
