---
layout: post
title: How I teach Git
additional_csp:
    img_src: git-scm.com marklodato.github.io lurklurk.org
discuss_url: https://dev.to/tbroyer/how-i-teach-git-3nj3/comments
---

I've been using Git for a dozen years.
Eight years ago, I had to give a training session on Git (and GitHub) to a partner company about to create an open source project, and I'm going to tell you here about the way I taught it.
Incidentally, we created internal training sessions at work since then that use the same (or similar) approach.
That being said, I didn't invent anything: this is heavily inspired by what others wrote before, including [the <cite>Pro Git</cite> book](https://git-scm.com/book/), though not in the same order, and that <abbr title="in my opinion">IMO</abbr> can make a difference.

The reason I'm writing this post is because over the years, I've kept seeing people actually _use_ Git without really understanding what they're doing; they'd either be locked into a very specific workflow they were told to follow, and unable to adapt to another that, say, an open source project is using (this also applies to open source maintainers not really understanding how external contributors use Git themselves), or they'd be totally lost if anything doesn't behave the way they thought it would, or if they made a mistake invoking Git commands.
I've been inspired to write it down by [Julia Evans](https://jvns.ca)' (renewed) interest in Git, as she sometimes ask for comments on social networks.

My goal is not to actually teach you about Git, but more about sharing my approach to teaching Git, for others who will teach to possibly take inspiration.
So if you're learning Git, this post was not written with you in mind (sorry), and as such might not be self-sufficient, but hopefully the links to other learning resources will be enough to fill the blanks are make it a helpful learning resource as well.
If you're a visual learner, those external learning resources are illustrated, or even oriented towards visual learning.

## Mental model

Once we're clear why we use a VCS (Version Control System) where we record changes inside _commits_ (or in other words we _commit our changes_ to the history; I'm assuming some familiarity with this terminology), let's look at Git more specifically.

One thing I think is crucial to understand Git, is getting an accurate mental model of the concepts behind it.

First, that's not really important, but Git doesn't actually record _changes_, but rather _snapshots_ of our files (at least conceptually; it will use _packfiles_ to store things efficiently and will actually store _changes_ –diffs– in some cases), and will generate diffs on-demand.
This sometimes shows in the result of some commands though (like why some commands show one file removed and another added, while other commands show a file being renamed).

Now let's dive into some Git concepts, or how Git implements some common VCS concepts.

### Commit

A Git _commit_ is:
 * one or more parent commit(s), or none for the very first commit (_root_)
 * a commit message
 * an author and an author date (actually a timestamp with timezone offset)
 * a committer and commit date
 * and our files: their pathname relative to the repository root, their _mode_ (UNIX file-system permissions), and their content

Each commit is given an identifier determined by computing the SHA1 hash of this information: change a comma and you get a different SHA1, a different _commit object_.
(<abbr title="For what it's worth">Fwiw</abbr>, Git is slowly [moving to SHA-256](https://git-scm.com/docs/hash-function-transition) as the hashing function).

<details>
<summary>Aside: how's the SHA1 computed?</summary>

Git's storage is _content-adressed_, meaning that each _object_ is stored with a name that's directly derived from its content, in the form of its SHA1 hash.

Historically, Git stored everything in files, and we can still reason that way.
A file's content is store as a _blob_, a directory is stored as _tree_ (a text file that lists files in the directory with their name, mode, and the SHA1 of the _blob_ representing their content, and their subdirectories with their name and the SHA1 their _tree_)

If you want the details, Julia Evans wrote an amazing (again) [blog post](https://jvns.ca/blog/2023/09/14/in-a-git-repository--where-do-your-files-live-/); or you can read it [from the <cite>Pro Git</cite> book](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects).

</details>

<figure>
<img src=https://git-scm.com/book/en/v2/images/commit-and-tree.png width=800 height=443 alt='A graph with 5 boxes organized in 3 columns, each box labelled with a 5-digit SHA1 prefix; the one on the left is sub-labelled "commit" and includes metadata "tree" with the SHA1 of the box in the middle, and "author" and "committer" both with value "Scott", and text "The initial commit of my project"; the box in the middle is sub-labelled "tree" and includes three lines, each labelled "blob", with the SHA1 of the 3 remaining boxes and what looks like file names: "README", "LICENSE" and "test.rb"; the last 3 boxes, aligned vertically on the right are all sub-labelled "blob" and contain what looks like the beginning of a README, LICENSE, and Ruby source file content; there are arrows linking boxes: the commit points to the tree, which points to the blobs.'>
<figcaption>A commit and its tree (source: <a src=https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell><cite>Pro Git</cite></a>)</figcaption>
</figure>

The _parent commit(s)_ in a _commit_ create a [directed acyclic graph](https://en.wikipedia.org/wiki/Directed_acyclic_graph) that represents our history:
a <dfn>directed acyclic graph</dfn> is made of nodes (our commits) linked together with directed edges (each commit links to its parent(s) commit(s), there's a direction, hence _directed_) and cannot have loops/cycles (a commit will never be its own ancestor, none of its ancestor commits will link to it as a parent commit).

<figure>
<img src=https://git-scm.com/book/en/v2/images/commits-and-parents.png width=800 height=265 alt='A graph with 6 boxes arranged in 2 lines and 3 columns; each box on the first line is labelled with a 5-digit SHA1 prefix, sub-labelled "commit" and with metadata "tree" and "parent" both with a 5-digit SHA1 prefix –different each time–, "author" and "committer" both with value "Scott", and some text representing the commit message; the box on the left has no "parent" value, the two other boxes have as "parent" the SHA1 of the box on their left; there&apos;s an arrow between those boxes, pointing to the left representing the "parent"; incidentally, the box on the left has the same SHA1 and same content as the commit box from the above figure; finally, each commit box also points to a box beneath it each labelled "Snapshot A", "Snapshot B", etc. and possibly representing the "tree" object linked from each commit.'>
<figcaption>Commits and their parents (source: <a src=https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell><cite>Pro Git</cite></a>)</figcaption>
</figure>

### References, branches and tags

Now SHA1 hashes are impractical to work with as humans, and while Git allows us to work with unique SHA1 prefixes instead of the full SHA1 hash, we'd need simpler names to refer to our commits: enter <dfn>references</dfn>.
Those are _labels_ for our commits that _we_ chose (rather than Git).

There are several kinds of _references_:
 * <dfn>branches</dfn> are _moving_ references (note that `main` or `master` aren't special in any way, their name is only a convention)
 * <dfn>tags</dfn> are _immutable_ references
 * <dfn>`HEAD`</dfn> is a special reference that points to the _current commit_.
   It generally points to a branch rather than directly to a commit (we'll see why later).
   When a reference points to another reference, this is called a [<dfn>symbolic reference</dfn>]({% post_url 2023-11-12-confusing-git-terminology %}#reference-symbolic-reference).
 * there are other special references (`FETCH_HEAD`, `ORIG_HEAD`, etc.) that Git will setup for you during some operations

<figure>
<img src=https://git-scm.com/book/en/v2/images/branch-and-history.png width=800 height=430 alt='A graph with 9 boxes; 6 boxes are arranged the same as the above figure, and are labelled the same (three commits and their 3 trees); two boxes above the right-most (latest) commit, with arrows pointing towards it, are labelled "v1.0" and "master" respectively; the last box is above the "master" box, with an arrow pointing towards it, and is labelled "HEAD".'>
<figcaption>A branch and its commit history (source: <a src=https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell><cite>Pro Git</cite></a>)</figcaption>
</figure>

### The three states

When you work in a Git repository, the files that you manipulate and record in the Git history are in your _working directory_.
To create commits, you'll _stage_ files in the [_index_]({% post_url 2023-11-12-confusing-git-terminology %}#index-staged-cached) or _staging area_.
When that's done you attach a commit message and move your _staged_ files to the _history_.

And to close the loop, the _working directory_ is initialized from a given commit from your _history_.

<figure>
<img src=https://git-scm.com/book/en/v2/images/areas.png width=800 height=441 alt='A sequence diagram with 3 participants: "Working Directory", "Staging Area", and ".git directpry (Repository)"; there&apos;s a "Checkout the project" message from the ".git directory" to the "Working Directory", then "Stage Fixes" from the "Working Directory" to the "Staging Area", and finally "Commit" from the "Staging Area" to the ".git directory".'>
<figcaption>Working tree, staging area, and Git directory (source: <a href="https://git-scm.com/book/en/v2/Getting-Started-What-is-Git%3F#_the_three_states"><cite>Pro Git</cite></a>)</figcaption>
</figure>

### Aside: ignoring files

Not all files need to have their history _tracked_: those generated by your build system (if any), those specific to your editor, and those specific to your operating system or other work environment.

Git allows defining naming patterns of files or directories to ignore.
This does not actually mean that Git will ignore them and they cannot be _tracked_, but that if they're not tracked, several Git operations won't show them to you or manipulate them (but you can manually add them to your history, and from then on they'll no longer be _ignored_).

Ignoring files is done by putting their pathname (possibly using globs) in ignore files:
 * `.gitignore` files anywhere in your repository define ignore patterns for the containing directory;
   those ignore files are tracked in history as a mean to share them between developers;
   this is where you'll ignore those files generated by your build system
   (`build/` for Gradle projects, `_site/` for an Eleventy website, etc.)
 * `.git/info/excludes` is local to the repository on your machine; rarely used but sometimes useful so good to know about
 * and finally `~/.config/git/ignore` is global to the machine (for your user); this is where you'll ignore files that are specific to your machine, such as those specific to the editors you use, or those specific to your operating system (e.g. the `.DS_Store` on macOS, or `Thumbs.db` on Windows)

### Summing up

Here's another representation of all those concepts:

<figure>
<img src=https://marklodato.github.io/visual-git-guide/conventions.svg width=907 height=529 alt='A graph with 10 boxes; 5 boxes are arranged as a line in the center, labelled with 5-digit SHA1 prefixes and with arrows between them pointing from right to left; a note describes them as "commit objects, identified by SHA-1 hash", another note describes one of the arrows as "child points to a parent"; a pair of boxes (looking like a single box split horizontally in two boxes) is above the right-most (latest) commit, with an arrow pointing down towards it, the upper box of the pair is labelled "HEAD" and described as "reference to the current branch"; the  lower box is labelled "main" and described as "current branch"; a seventh box is above another commit, with an arrow pointing down towards it; it&apos;s labelled "stable" and described as "another branch"; the last two boxes are under the commit history, one above the other; the bottom-most box is labelled "Working Directory" and described as "files that you &apos;see&apos;", the other box, between it and the commit history, is labelled "Stage (Index)" and described as "files to go in the next commit".'>
<figcaption>Commits, references, and areas (source: <a href=https://marklodato.github.io/visual-git-guide/index-en.html#conventions><cite>A Visual Git Reference</cite></a>, Mark Lodato)</figcaption>
</figure>

## Basic operations

This is where we start talking about Git commands, and how they interact with the graph:

 * `git init` to initialize a new repository
 * `git status` to get a summary of your files' state
 * `git diff` to show changes between any two of your working directory, the index, the `HEAD`, or actually between any commit
 * `git log` to show and search into your history
 * creating commits
   * `git add` to add files to the _index_
   * `git commit` to transform the _index_ into a _commit_ (with an added _commit message_)
   * `git add -p` to add files interactively to the _index_:
      pick which changes to add and which ones to leave only in your working directory,
      on a file-by-file, part-by-part (called _hunk_) basis
 * managing branches
   * `git branch` to show branches, or create a branch
   * `git switch` (also `git checkout`) to check out a branch (or any commit, any _tree_, actually) to your working directory
   * `git switch -b` (also `git checkout -b`) as a shortcut for `git branch` and `git switch`
 * `git grep` to search into your working directory, index, or any commit;
   this is kind of an enhanced `grep -R` that's aware of Git
 * `git blame` to know the last commit that changed each line of a given file (so, who to blame for a bug)
 * `git stash` to put uncommitted changes aside (this includes _staged_ files, as well as _tracked_ files from the working directory), and later _unstash_ them.

### Commit, branch switching, and HEAD

When you create a commit (with `git commit`), Git not only creates the _commit object_, it also moves the `HEAD` to point to it.
If the `HEAD` actually points to a branch, as is generally the case, Git will move that branch to the new commit (and `HEAD` will continue to point to the branch).
Whenever the current branch is an ancestor of another branch (the commit pointed by the branch is also part of another branch), committing will move `HEAD` the same, and branches will _diverge_.

When you switch to another branch (with `git switch` or `git checkout`), `HEAD` moves to the new current branch, and your working directory and index are setup to ressemble the state of that commit (uncommitted changes are tentatively kept; if Git is unable to do it, it will refuse the switch).

For more details, and visual representations, see the [commit](https://marklodato.github.io/visual-git-guide/index-en.html#commit) and [checkout](https://marklodato.github.io/visual-git-guide/index-en.html#checkout) sections of Mark Lotato's <cite>A Visual Git Reference</cite> (be aware that this reference was written years ago, when `git switch` and `git restore` didn't exist and `git checkout` was all we had; so the _checkout_ section covers a bit more than `git switch` as a result).
Of course, the <cite>Pro Git</cite> book is also a good reference with visual representations; [the <cite>Branches in a Nutshell</cite> subchapter](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell) covers a big part of all of the above.

### Aside: Git is conservative

As we've seen above, due to its _content-addressed storage_, any “change” to a commit (with `git commit --amend` for instance) will actually result in a different commit (different SHA1).
The _old commit_ won't disappear immediately: Git uses _garbage collection_ to eventually delete commits that aren't reachable from any _reference_.
This means that many mistakes can be recovered if you manage to find the commit SHA1 back (`git reflog` can help here, or the notation `<branch-name>@{<n>}`, e.g. `main@{1}` for the last commit that `main` pointed to before it changed).

### Working with branches

We've seen above how branches can diverge.
But diverging calls for eventually _merging_ changes back (with `git merge`).
Git is very good at that (as we'll see later).

A special case of merging is when the current branch is an ancestor of the branch to merge into.
In this case, Git can do a [<dfn>fast-forward merge</dfn>]({% post_url 2023-11-12-confusing-git-terminology %}#can-be-fast-forwarded).

Because operations between two branches will likely always target the same pair of branches, Git allows you to setup a branch to _track_ another branch.
That other branch with be called the _upstream_ of the branch that _tracks_ it.
When setup, `git status` will, for example, tell you how much the two branches have diverged from one another: is the current branch [_up to date_]({% post_url 2023-11-12-confusing-git-terminology %}#your-branch-is-up-to-date-with-originmain) with its upstream branch, _behind it_ and [can be fast-forwarded]({% post_url 2023-11-12-confusing-git-terminology %}#can-be-fast-forwarded), _ahead_ by a number of commits, or have they diverged, each by some number of commits.
Other commands will use that information to provide good default values for parameters so they can be omitted.

To integrate changes from another branch, rather than merging, another option is to _cherry-pick_ (with the same-named command) a single commit, without its history:
Git will compute the changes brought in by that commit and apply the same changes to the current branch, creating a new commit similar to the original one
(if you to know more about how Git actually does it, see Julia Evans' [<cite>How git cherry-pick and revert use 3-way merge</cite>](https://jvns.ca/blog/2023/11/10/how-cherry-pick-and-revert-work/)).

Finally, another command in your toolbelt is `rebase`.
You can see it as a way to do many cherry-picks at once but it's actually much more powerful (as we'll see below).
In its basic use though, it's just that: you give it a range of commits (between any commit as the starting point and an existing branch as the end point, defaulting to the current one) and a target, and it cherry-picks all those commits on top of the target and finally updates the branch used as the end point.
The command here is of the form `git rebase --onto=<target> <start> <end>`.
As with many Git commands, arguments can be omitted and will have default values and/or specific meanings: thus, `git rebase` is a shorthand for `git rebase --fork-point upstream` where `upstream` is the [upstream]({% post_url 2023-11-12-confusing-git-terminology %}#untracked-files-remote-tracking-branch-track-remote-branch) of the current branch (I'll ignore `--fork-point` here, its effect is subtle and not that important in every-day use), which itself is a shorthand for `git rebase upstream HEAD` (where `HEAD` must point to a branch), itself a shorthand for `git rebase --onto=upstream upstream HEAD`, a shorthand for `git rebase --onto=upstream $(git merge-base upstream HEAD) HEAD`, and will rebase all commits between the last common ancestor of `upstream` and the current branch on one hand and the current branch (i.e. all commits since they diverged) on the other hand, and will reapply them on top of `upstream`, then update the current branch to point to the new commits.
Explicit use of `--onto` (with a value different from the starting point) is rare actually, see [my previous post]({% post_url 2023-11-12-confusing-git-terminology %}#git-rebase---onto) for one use case.

We cannot present `git rebase` without its interactive variant `git rebase -i`:
it starts with exactly the same behavior as the non-interactive variant,
but after computing what needs to be done, it'll allow you to edit it (as a text file in an editor, one action per line).
By default, all selected commits are cherry-picked, but you'll be able to reorder them, to skip some commit(s), or even combine some into a single commit.
You can actually cherry-pick a commit that was not initially selected, and even create merge commits, thus entirely rewriting the whole history!
Finally, you can also stop on a commit to _edit_ it (using `git commit --amend` then, and/or possibly create new commits before continuing with the rebase), and/or run a given command between two commits.
This last option is so useful (to e.g. validate that you didn't break your project at each point of the history) that you can pass that command in an `--exec` option and Git will execute it between each rebased commit (this works with non-interactive rebase too; in interactive mode you'll see execution lines inserted between each cherry-pick line when given the ability to edit the rebase scenario).

For more details, and visual representations, see the [merge](https://marklodato.github.io/visual-git-guide/index-en.html#merge), [cherry pick](https://marklodato.github.io/visual-git-guide/index-en.html#cherry-pick), and [rebase](https://marklodato.github.io/visual-git-guide/index-en.html#rebase) sections of Mark Lodato's <cite>A Visual Git Reference</cite>, and the [<cite>Basic Branching and Merging</cite>](https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging), [<cite>Rebasing</cite>](https://git-scm.com/book/en/v2/Git-Branching-Rebasing), and [<cite>Rewriting History</cite>](https://git-scm.com/book/en/v2/Git-Tools-Rewriting-History) subchapters of the <cite>Pro Git</cite> book.
You can also look at the “branching and merging” diagrams from David Drysdale's [<cite>Git Visual Reference</cite>](https://lurklurk.org/gitpix/gitpix.html).

## Working with others

For now, we've only ever worked locally in our repository.
But Git was specifically built to work with others.

Let me introduce _remotes_.

### Remotes

When you _clone_ a repository, that repository becomes a <dfn>remote</dfn> of your local repository, named `origin` (just like with the `main` branch, this is just the default value and the name in itself has nothing special, besides sometimes being used as the default value when an command argument is omitted).
You'll then start working, creating local commits and branches (therefore _forking_ from the remote), and the remote will probably get some more commits and branches from its author in the mean time.
You'll thus want to synchronize those remote changes into your local repository, and want to quickly know what changes you made locally compared to the remote.
The way Git handles this is by recording the state of the remote it knows about (the branches, mainly) in a special namespace: `refs/remote/`.
Those are known as [<dfn>remote-tracking branches</dfn>]({% post_url 2023-11-12-confusing-git-terminology %}#untracked-files-remote-tracking-branch-track-remote-branch).
Fwiw, local branches are stored in the `refs/heads/` namespace, and tags in `refs/tags/` (tags from remotes are generally _imported_ right into `refs/tags/`, so for instance you lose the information of where they came from).
You can have as many remotes as needed, each with a name.
(Note that remotes don't necessarily live on other machines, they can actually be on the same machine, accessed directly from the filesystem, so you can play with remotes without having to setup anything.)

### Fetching

Whenever you _fetch_ from a remote (using `git fetch`, `git pull`, or `git remote update`), Git will talk to it to download the commits it doesn't yet know about, and will update the _remote-tracking branches_ for the remote.
The exact set of references to be fetched, and where they're fetched, is passed to the `git fetch` command (as [refspecs]({% post_url 2023-11-12-confusing-git-terminology %}#refspecs)) and the default value defined in your repository's `.git/config`, and configured by default by `git clone` or `git remote add` to taking all branches (everything in `refs/heads/` on the remote) and putting them in `refs/remote/<remote>` (so `refs/remote/origin/` for the `origin` remote), with the same name (so `refs/heads/main` on the remote becomes `refs/remote/origin/main` locally).

<figure>
<img src=https://git-scm.com/book/en/v2/images/remote-branches-5.png width=800 height=577 alt='A diagram with 3 big boxes, representing machines or repositories, containing smaller boxes and arrows representing commit histories; one box is labelled "git.outcompany.com", sublabelled "origin", and includes commits in a branch named "master"; another box is labelled "git.team1.outcompany.com", sublabelled "teamone", and includes commits in a branch named "master"; the commit SHA1 hashes are the same in "origin" and "teamone" except "origin" has one more commit on its "master" branch, i.e. "teamone" is "behind"; the third box is labelled "My Computer", it includes the same commits as the other two boxes, but this time the branches are named "origin/master" and "teamone/master"; it also includes two more commits in a branch named "master", diverging from an earlier point of the remote branches.'>
<figcaption>Remotes and remote-tracking branches (source: <a href=https://git-scm.com/book/en/v2/Git-Branching-Remote-Branches><cite>Pro Git</cite></a>)</figcaption>
</figure>

You'll then use branch-related commands to get changes from a _remote-tracking branch_ to your local branch (`git merge` or `git rebase`), or `git pull` which is hardly more than a shorthand for `git fetch` followed by a `git merge` or `git rebase`.
<abbr title="By the way">BTW</abbr>, in a number of situations, Git will automatically setup a _remote-tracking branch_ to be the _upstream_ of a local branch when you create it (it will tell you about it when that happens).

### Pushing

To share your changes with others, they can either add your repository as a remote and _pull_ from it (implying accessing your machine across the network), or you can _push_ to a remote.
(If you ask someone to pull changes from your remote, this is called a… _pull request_, a term you'll have probably heard of from GitHub or similar services.)

Pushing is similar to fetching, in reverse: you'll send your commits to the remote and update its branch to point to the new commits.
As a safety measure, Git only allows remote branches to be _fast-forwarded_;
if you want to push changes that would update the remote branch in a non-fast-forward way, you'll have to _force_ it, using `git push --force-with-lease` (or `git push --force`, but be careful: `--force-with-lease` will first ensure your _remote-tracking branch_ is up-to-date with the remote's branch, to make sure nobody pushed changes to the branch since the last time you _fetched_; `--force` won't do that check, doing what you're telling it to do, at your own risks).

As with `git fetch`, you pass the branches to update to the `git push` command, but Git provides a good default behavior if you don't.
If you don't specify anything, Git will infer the remote from the _upstream_ of the current branch, so most of the time `git push` is equivalent to `git push origin`.
This actually is a shorthand to `git push origin main` (assuming the current branch is `main`), itself a shorthand for `git push origin main:main`, shorthand for `git push origin refs/heads/main:refs/heads/main`, meaning to push the local `refs/heads/main` to the `origin` remote's `refs/heads/main`.
See [my previous post]({% post_url 2023-11-12-confusing-git-terminology %}#refspecs) for some use cases of specifying _refspecs_ with differing source and destination.

<figure>
<img src=https://lurklurk.org/gitpix/push2.svg width=1052 height=744 alt='A diagram representing a "git push" command, with four git graph diagrams (dots, some labelled, connected by lines) arranged in two lines and two columns; an arrow in between the columns implies that the left column is a "before" state and the right column an "after" state; graphs on the above line are inside a cloud, representing a remote repository, and have two branches, "master" and "other", that diverged from a common ancestor; the bottom left diagram has the same shape as the one above it except the labels are changed to "origin/master" and "origin/other" and each branch has more commits: the "master" branch has two additional commits compared to "origin/master", and "other" has one more commit thatn "origin/other"; the top right diagram has two more commits in its "master" branch compared to the top left diagram; the bottom right diagram is identical to the bottom left one except "origin/master" now points to the same commit as "master"; in other words, in the "before" state, the remote lacked three commits, and after the "git push" the two commits from the local "master" branch were copied to the remote while "other" was left untouched.'>
<figcaption><code>git push</code> (source: <a href=https://lurklurk.org/gitpix/gitpix.html><cite>Git Visual Reference</cite></a>, David Drysdale)</figcaption>
</figure>

For more details, and visual representations, see the [<cite>Remote Branches</cite>](https://git-scm.com/book/en/v2/Git-Branching-Remote-Branches), [<cite>Working with Remotes</cite>](https://git-scm.com/book/en/v2/Git-Basics-Working-with-Remotes), and [<cite>Contributing to a Project</cite>](https://git-scm.com/book/en/v2/Distributed-Git-Contributing-to-a-Project) subchapters of the <cite>Pro Git</cite> book, and the “dealing with remote repositories” diagrams from David Drysdale's [<cite>Git Visual Reference</cite>](https://lurklurk.org/gitpix/gitpix.html).
The <cite>Contributing to a Project</cite> chapter of <cite>Pro Git</cite> also touches about contributing to open source projects on platforms like GitHub, where you have to first _fork_ the repository, and contribute through _pull requests_ (or _merge requests_).

## Best practices

Those are directed towards beginners, and hopefully not too controversial.

Try to keep a _clean_ history:
 * use merge commits wisely
 * clear and high-quality commit messages (see the [<cite>commit guidelines</cite>](https://git-scm.com/book/en/v2/Distributed-Git-Contributing-to-a-Project#_commit_guidelines) in <cite>Pro Git</cite>)
 * make _atomic_ commits: each commit should be compile and run independently of the commits following it in the history

This only applies to the history you share with others.
Locally, do however you want.
For beginners, I'd give the following advices though:
 * don't work directly on `main` (or `master`, or any branch that you don't specifically _own_ on the remote as well), create local branches instead;
   it helps decoupling work on different tasks: about to start working on another bug or feature while waiting for additional details on instructions on the current one? switch to another branch, you'll get back to that later by switching back;
   it also makes it easier to update from the remote as you're sure you won't have conflicts if your local branches are simply copies of the remote ones of the same name, without any local change (except when you want to push those changes to that branch)
 * don't hesitate to rewrite your commit history (`git commit --amend` and/or `git rebase -i`), but don't do it too early; its more than OK to stack many small commits while working, and only rewrite/cleanup the history before you share it
 * similarly, don't hesitate to rebase your local branches to integrate upstream changes (until you shared that branch, at which point you'll follow the project's how branching workflow)

In case of any problem and you're lost, my advice is to use `gitk` or `gitk HEAD @{1}`, also possibly `gitk --all` (I'm using `gitk` here but use whichever tool you prefer), to visualize your Git history and try to understand what happened.
From this, you can rollback to the previous state (`git reset @{1}`) or try to fix things (cherry-picking a commit, etc.)
And if you're in the middle of a rebase, or possibly a failed merge, you can abort and rollback to the previous state with commands like `git rebase --abort` or `git merge --abort`.

To make things even easier, don't hesitate, before any possibly destructive command (`git rebase`), to create a branch or a tag as a "bookmark" you can easily reset to if things don't go as expected.
And of course, inspect the history and files after such a command to make sure the outcome is the one you expected.

## Advanced concepts

Only a few of them, there are many more to explore!

 * Detached `HEAD`: the [`git checkout` manpage](https://git-scm.com/docs/git-checkout#_detached_head) has a good section on the topic, also see [my previous post]({% post_url 2023-11-12-confusing-git-terminology %}#detached-head-state), and for a good visual representation, see the [<cite>Committing with a Detached HEAD</cite>](https://marklodato.github.io/visual-git-guide/index-en.html#detached) section of Mark Lodato's <cite>A Visual Git Reference</cite>.
 * Hooks: those are executables (shell scripts most of the time) that Git will run in reaction to operations on a repository; people use them to lint the code before each commit (aborting the commit if that fails), generate or post-process commit messages, or trigger actions on the server after someone pushes to the repository (trigger builds and/or deployments).
 * A couple rarely needed commands that can save you hours when you actually need them:
   * `git bisect`: an advanced command to help you pinpoint which commit introduced a bug, by testing several commits (manually or through scripting); with a linear history, this is using bisection and could be done manually, but as soon as you have many merge commits this becomes much more complex and it's good to have `git bisect` do the heavy lifting.
   * `git filter-repo`: a [third-party command](https://github.com/newren/git-filter-repo) actually, as a replacement to Git's own `filter-branch`, that allows rewriting the whole history of a repository to remove a mistakenly added file, or help extract part of the repository to another.

We're done.

With this knowledge, one should be able to map any Git command to how it will modify the _directed acyclic graph_ of commits, and understand how to fix mistakes (ran a merge on the wrong branch? rebased on the wrong branch?)
I'm not saying understanding such things will be _easy_, but should at least be possible.
