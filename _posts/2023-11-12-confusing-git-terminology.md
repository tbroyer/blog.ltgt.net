---
layout: post
title: Confusing git terminology
---

Next week, [Julia Evans](https://jvns.ca) published on her blog about [confusing git terminology](https://jvns.ca/blog/2023/11/01/confusing-git-terminology/).
This is an awesome post but not all explanations resonated with me so I thought I'd write my own version (or rather, add my own notes) in case others felt the same
(Julia, feel free to cherry pick from here to your blog 😉).
I'll also reorder them to make it easier to cross-reference without you having to jump around.

## My mental representation of git

First, let me quickly describe how I represent a git repository in my head.

A git repository is a set of [directed acyclic graphs](https://en.wikipedia.org/wiki/Directed_acyclic_graph) of commits.
In many cases a repository has only one such graph, but there can actually be multiple (early users of GitHub Pages know about the `gh-pages` branch, in most case it's an entirely separate branch, a separate graph not connected in any wayto the other branches).

Then to easily reference some of those commits, we put _labels_ on them: those are our branches and tags (among other things).

Each git repository on a machine contains such a set of directed acyclic graphs of commits,
and each time you `git clone`, `git fetch` and `git push` you copy parts of these graphs between repositories.

You can use `gitk --all` or `git log --all --oneline --graph` to visualize the graphs known on your matchine.

## HEAD and “heads”

[As Julia says](https://jvns.ca/blog/2023/11/01/confusing-git-terminology/#head-and-heads), “heads” are “branches” (contrary to tags that are immutable, those “heads” move along the graph).

The way I see `HEAD` though is more like “what's been checked out in the working directory”.
It will thus indeed be “the current branch” most of the time, but not always (we'll come to those cases below).

One interesting thing: a remote repository also has a `HEAD`, it then represents the “default branch” that will be checked out when you clone the repository (unless you tell git to checkout a specific branch).
Actually, git makes no distinction between a repository on a server that everyone will clone from (e.g. on GitHub), and any of these clones: git is decentralized before all.
You can even clone from a repository you already have on your machine, and observe that the branch that will be checked out by default will be that source repository's `HEAD`.
When you change the “default branch” of your repository on GitHub, what you're actually doing is updating its `HEAD`.

## “reference”, “symbolic reference”

A reference is any _label_ on a commit in the directed acyclic graph of commits.
It allows you to _reference_ (sic!) a commit by a (somewhat) simple name (much simpler than the commit ID at least).
Those are branches (local and remote), tags, as well as `HEAD`, `FETCH_HEAD`, `ORIG_HEAD`, `MERGE_HEAD`, etc.

A symbolic reference is a reference that points to another reference, rather than directly to a commit.
This is the case of `HEAD` when you checkout a branch: it points to the branch so that git knows to move that branch forward when you make a new commit.

Note that [as Julia notes](https://jvns.ca/blog/2023/11/01/confusing-git-terminology/#reference-symbolic-reference),
`HEAD^^^` is not technically a reference, it's one of [many different ways](https://git-scm.com/docs/revisions) of specifying revisions (another name for a commit).

## “index”, “staged”, “cached”

I have nothing to add to [what Julia wrote](https://jvns.ca/blog/2023/11/01/confusing-git-terminology/#index-staged-cached).
tl;dr: they're all the same thing, but `--cached` (or `--staged` which is a synonym) and `--index` mean slightly different things.

## “untracked files”, “remote-tracking branch”, “track remote branch”

The word “track” here has three different meanings:

 * an “untracked file” is a file that's not included in `HEAD` or the index (technically it could exist in another commit, but when only looking at `HEAD` and comparing it to the state of your working directory, it only exists in your working directory and not in `HEAD` or in the index)

 * a “remote-tracking branch” is a reference that corresponds to a branch in a remote repository that you fetched.
   Whenever you `git fetch` (or `git clone`) from a remote repository, the branches in that remote repository (in `refs/heads/` there) are copied/updated to your repository under new names, in `refs/remote/<remotename>/` rather than `ref/heads/` (`refs/heads/` being reserved for _local_ branches).
   Those `refs/remote/<remotename>/` branches are thus _tracking_ the corresponding `refs/heads/` from the remote repository.

 * in git, a branch can be configured to “track” another (e.g. using `git branch --track` when creating a branch, `git branch --set-upstream-to=` to change a branch); that other branch is then said to be the “upstream” of the former.
   Git will use that information in `git status` to tell you by how many commits the two branches diverge, and in `git pull` and `git push` to _synchronize_ the two branches.
   The “upstream” branch can be a “remote-tracking branch” or a local branch.
   When you `git switch` (or `git checkout`) to a local branch that actually doesn't exist but has a name match in a single remote, git will automatically create it from the matching “remote-tracking branch”, and set it up to “track” it
   (by extension, the repository you cloned/forked from, and whose branches you'll track, can also be called the “upstream repository”).

## “detached HEAD state”

When the `HEAD` points to a (local) branch, each new commit will move the branch _label_ to the new commit.

When the `HEAD` points to anything else than a (local) branch, git won't be able to move the reference to a new commit: you're in a “detached HEAD state”, if you make a new commit, only `HEAD` will reference it and nothing else, so if you switch to a branch you'll no longer have any reference (_label_) to that commit.
In other words, you're in a “detached HEAD state” when `HEAD` is **not** a “symbolic reference” but directly references a commit.

Note that when you checkout anything that's not a local branch (in `refs/heads/`), whether it's a tag or a “remote tracking branch”, git will resolve it to the commit ID and setup `HEAD` to point to that ID, so you'll be in a “detached HEAD state”.

## “ours” and “theirs” while merging or rebasing

“Ours” and “theirs”, or “local” and “remote”, are indeed confusing.

When merging, you merge another branch into the current branch: the current branch is “ours” and the other one is thus “theirs”.

But when rebasing the current branch on top of another branch, you're repeatedly cherry-picking the commits from the current branch on top of the other branch, so the other branch is “ours” or “local”, and the commits from the current branch are “theirs”.
To make things a bit clearer, I like to think of how rebase work (conceptually at least): after determining the list of commits that defers between the branches and need to be rebased, first checkout the other (target) branch, then for each commit in the list cherry-pick it, and finally update the branch to point to the last rebased commit. Because you start by moving to the branch on top of which you want to rebase, it becomes the “ours” or “local”, and the branch you started from becomes the “theirs” or “remote”.

## “Your branch is up to date with ‘origin/main’”

This is directly derived from the “tracking” of your branch, as seen above:
if your current branch “tracks” `refs/remote/origin/main`, then `git status` will display by how much commit the two branches diverge.
When they don't diverge (i.e. both references point to the exact same commit), then the branch is said to be “up to date” with its “upstream”.

Remember though, [as Julia points out](https://jvns.ca/blog/2023/11/01/confusing-git-terminology/#your-branch-is-up-to-date-with-origin-main),
that `refs/remote/origin/main` is only updated when you explicitly fetch from the remote repository (with `git fetch`, `git pull`, or `git remote update`).

## “can be fast-forwarded”

This is another message you can see in the output of `git status` related to the state of this branch relative to its “upstream” branch.
We've seen that when they both point to the same commit you'll get an “is up-to-date” message; this one is another situation when the branches have not diverged, but they're not identical either.
This happens when the current branch is “behind” its “upstream”: it points to a commit that's part of the “upstream”, but “upstream” actually has more commits.

```text
A - B (main)
     \
      C - D (origin/main)
```
or if you prefer
```text
A - B (main) - C - D (origin/main)
```

This will typically be the case when you did `git pull` a few days ago to bring your `main` “up-to-date” with `origin/main` (at that time, both `main` and `origin/main` pointed to commit B) and didn't touch it since then, and things continued moving in the `origin` remote repository (commits C and D were added).
When you `git fetch origin main`, you retrieve commits C and D locally into `origin/main`; now `main` can be “fast-forwarded” to commit D by just moving the `main` _label_ along the graph towards `origin/main`.

In other words, there's no need to create a merge commit when running `git merge` (or `git pull`), and there's no risk of merge conflict.
There's hardly any situation safer than a “fast-forward merge”.

Note that such a “fast-forward merge” can actually bring in merge commits (here, `main` can be fast-forwarded to `origin/main`, and bring in commits C, D, E, F, and G):

```text
A - B (main) - C - D (origin/main)
 \            /
  E -- F --- G (origin/newfeature)
```

As for the name, I like to imagine those commits as a timeline, or a tape in a tape cassette or VHS.
You were following changes but ⏸️ _paused_ a few days ago at your last `git pull`.
Git knows that there's `origin/main` ahead in a “straight line” so you can just press the “⏩ fast forward” button to safely reach that new state.

The other situations you can experience that are neither an “is up to date with” or “can be forwarded” are:
 * when your branch has more commits than its “upstream”: git will show “Your branch is ahead of 'origin/main' by N commits”
   ```
   A - B (origin/main)
        \
         C - D (main)
   ```
 * when they have diverged: “Your branch and 'origin/main' have diverged, and have M and N different commits each, respectively”
   ```
   A - B (main)
    \
     C - D (origin/main)
   ```

## HEAD^, HEAD~, HEAD^^, HEAD~~, HEAD^2, HEAD~2

When you need to specify commits as parameters to git commands, one way is to use the commit ID, or a reference (branch, tag) name.
But git makes it easier for those commits that are not directly pointed by a reference: if you know how to find that commit then no need to use `git log` to go search the commit ID yourself, you can tell git how to get to it from another commit.

That's what the `^` and `~` suffixes do (there are [other notations](https://git-scm.com/docs/revisions) as well).

So `^` is actually a shorthand for `^1` which takes the “first parent” of the commit you apply it to.
Most commits have only a single parent, but merge commits will have at least 2 (yes, at least, you can actually have merge commits with more than 2 parents),
so `^` or `^1` will take the first, and `^2` the second (and `^3` the third, you got it).

`HEAD^^` actually just applies the `^` operator to `HEAD^`, which itself had applied it to `HEAD`, therefore taking “two commits ago”.

To make it easier to follow the “first parents”, the `~` operator can be used.
Similarly, `~` is actually a shorthand for `~1`.
Directly taken for [the docs](https://git-scm.com/docs/revisions), `~3` is equivalent to `^^^` and directly expressed “three commits before” (or “three commits ago” when applied to `HEAD`).
So “ten commits ago” can be written either `HEAD^^^^^^^^^^` or `HEAD~10`, one is easier to read than the other 😉

## .. and ...

Those are generally used with `git log` and `git diff`.

The notation `r1..r2` selects all commits reachable from `r2` that are not reachable from `r1` (note that `r1` and `r2` can be any form of revision: a reference or a commit ID),
whereas `r1...r2` selects all commits reachable from either `r1` or `r2` but not both.

In a typical tree with two diverging branches like this:
```
A - B (main)
  \ 
    C - D (test)
```
the notation `main..test` will select all of B, C and D (but not A), whereas `main...test` will select commits C and D only.

Note that the behavior is different with `git diff`, as `git diff` is about comparing two points in the graph, not a range of commits!
`git diff` thus has its own definition for `..` and `...`: whereas `git diff r1..r2` is equivalent to `git diff r1 r2`, showing the difference between those 2 commits,
`git diff r1...r2` will however find the last common ancestor of `r1` and `r2` (same as `git merge-base r1 r2`), and diff between that common ancestor and `r2`.
In other words, `git diff main...test` will show the changes in `test` since the point it diverged from `main` (what changes did I add to my branch, ignoring commits added to the “upstream” since then? or what changes exist in my “upstream” branch since I branched out, ignoring changes in my branch?)

While this might seem the reverse of `git log` (commit B is _taken into account_ by `git log main...test` but not `git log main...test`, and by `git diff main...test` but not `git diff main..test`), this is actually rather consistent with `git log`, at least for `...`: `git log main...test` and `git diff main...test` will both only tell you about commits C and D (notice that this is what GitHub is using when clicking on those _compare_ links).

TL;DR: forget about the `..` notation, it's almost never what you want for `git log`,
use either `...` or the space-separated form of `git diff`.

## refspecs

Refspecs are used by `git fetch` and `git push` to determine what to fetch or push, respectively, and the mapping between local references and remote ones (though most of the time one uses those commands without an explicit refspec).
A default refspec can also be configured for a _remote_ (remote repository) for each action (fetch or push); one will generally be configured for fetching.

When you clone a repository, git sets up a remote named `origin` and configures its default refspec, generally with `+refs/heads/*:refs/remotes/origin/*` but this can differ depending on the options passed to `git clone`.

This refspec tells git that when fetching from the remote repository,
all the references inside `refs/heads/` (due to the `*` wildcard) will be fetched and stored locally into `refs/remote/origin/` (using the same name suffix).
The `+` is equivalent to passing `--force` to the commands and will update the destination reference even if the new value is not “fast-forwarded” from the current value.
When fetching, this means that if someone force-pushed a branch, git will update the corresponding `refs/remote/` on your side to make it match the remote reference; without the `+`, your “remote-tracking branch” would instead stay desynchronized.

The `--tags` flag is actually a shorthand to adding the `refs/tags/*:refs/tags/*` refspec: tags are synchronized (either fetched or pushed, depending on the command) between repositories (without overwriting existing tags at the destination).

As I said above, you can actually use those refspecs for pushing too.

For example, with `git push origin HEAD:test` you will update (or possibly create) a `test` branch on the remote repository (git will expand `test` to `refs/heads/test`) to point to the commit that's locally your `HEAD` (this will send the appropriate commits to the remote to make it possible).
I use this from time to time on side-projects where I'm the only maintainer to test local commit on a scratch branch, to trigger my GitHub Actions; if the build pass, then only will I push to `main`; all without having to create that `test` branch locally.

I sometimes also use the form `git push origin main^:main` to push my `main` branch, except for its last commit, that I will keep local as it's likely a work in progress.

People working with [Gerrit](https://gerritcodereview.com/) will be familiar with `git push origin HEAD:refs/for/main` to push commits for review (`refs/for` is a _magic_ namespace in Gerrit to push for review for a target branch), and now you know what it means 😉.

You might sometimes also see things like `git push origin :test`, this will delete the remote `test` branch, and is equivalent to `git push --delete test` (and it was the only way to delete a remote branch or tag before the `--delete` flag was added).

## “reset”, “revert”, “restore”

Those three terms are all meant to somehow _destroy_ something, but in different ways. Eck there's even [a section of the docs](https://git-scm.com/docs/git#_reset_restore_and_revert) dedicated to disambiguating them!

 * “reset” is meant to _move_ the current branch to another commit (a “fast-forward merge” is actually equivalent to a “reset”), though it can also be used to manipulate the “index” (opposite of `git add` and equivalent to `git restore --staged`).
   You can tell `git reset` what to do of your index and working tree with flags such as `--hard`.
 * “revert” will create new commits that will undo the effects of previous commits
 * “restore” is all about files in your working directory or index, to undo changes made to them and restore them to a specific version recorded in some commit or the index.

## checkout

The `git checkout` command can do two seamingly unrelated things:

 * “switching” to another branch, and
 * “restoring” files from a given commit

Technically, those are actually quite similar as they're about changing files in your working directory, and in the case of “switching” also changing what `HEAD` points to.

Nowadays, you should rather use the `git switch` and `git restore` commands to the same effects.

## “tree-ish”

In git, each commit is a _snapshot_ of the state of the repository, along with some metadata (among them the commit message, committer, and author).
That _snapshot_ is stored as a _tree object_.
A “tree-ish” is anything that resolves to a _tree object_: either the tree ID itself, or a _commit-ish_ (a commit ID, a reference name, possibly using the `^` or `~` operators as seen above).

Technically you can also refer to a subtree (directory) of a given tree-ish by suffixing it with `:` followed by the path of the directory.
While I sometimes use this notation with `git show` to refer to files (show me the content of the given file inside that commit), I've never ever used it for a subtree (this can apparently be used with `git restore --source=`, `git checkout`, and `git reset`; looks like a very advanced feature to me).

## reflog

The reflog, or reference log, is kind of an _audit log_ of any change ever done to references in your local repository.

You'll almost never use it but it can save yourself in some gnarly situations, to recover things you accidentally deleted.

## merge vs rebase vs cherry-pick

I have to say I don't quite understand how those terms are confusing 🤷

I suppose this is due to _superficial_ knowledge of git; knowing mostly git commands and not really having a mental representation of the concepts at hand.
Git core concepts aren't that hard to comprehend, but if nobody explains them to you and you only learned to use git by memorizing a few commands, you can quickly get lost, particularly when told to change your workflow
(fwiw, this is I think the main reason we created internal training sessions at work, starting from those concepts towards the commands that manipulate them, dispensed to all new hires).

The commands can sometimes be confusing to use though:

 * `git merge` will create a new commit joining two lines of commit history (two branches)
 * `git rebase` will _replay_ your commits on top of another commit (selecting the commits since the last common ancestor). In more advanced use cases, you can also specify exactly which set of commits to rebase, and onto which commit to rebase them (see below).

   Because git stores _snapshots_, and not diffs, it will compute the diff of each commit (similar to `git diff`) and apply it on the new base.
   Julia [has a wonderful post](https://jvns.ca/blog/2023/11/10/how-cherry-pick-and-revert-work/) explaining how this all works in details.

   `git rebase` also has some super powers in the form of its interactive mode, where you can tell it to reorder the commits, skip some, squash others into a single commit, etc.
   You generally use this form to _replay_ your history without changing your “base”.
 * `git cherry-pick` will also _replay_ a commit, but works kinda the reverse of `git rebase`: you tell it which commit (from another branch) to _replay_ on top of your current branch; the commits from your current branch don't change, you're creating a new commit that does the same as another commit from another branch.

The thing to remember: `git rebase` can be _destructive_, so use with care and don't hesitate to create a branch as _bookmark_ before you rebase, and/or abort your rebase if you feel like you lose control of it.
That being said, my personal workflow involves rebasing a lot

## git rebase --onto

When you use `git rebase main` to rebase your current branch on top of main (e.g. just before merging it, as a “fast-forward merge”, because you like your history to be linear; or just to avoid all those merge commits whenever you want to sync your feature branch with new changes from `main`), git will first find the last common ancestor between your current branch and `main`, and get the list of commits in your branch since that point (this is the exact equivalent to `git log main...` or `git log main...HEAD` if you remember). It will then _replay_ them on top of `main`.

So `main` is used twice here: to find which commit to rebase, and “onto” which base.

Imagine you started working on a new feature, so you branched from `main` at some point.
Then management decides that the feature becomes a priority and should be released early, without other features that already landed on `main`.
So a new branch (let's call it `release-X`) is created from an earlier point of `main` than you branched from, then possibly a few bugfixes are cherry-picked too.
You would then want to take all the commits from your branch and move them as if you branched from that new branch (or any earlier point from `main` than you initially branched from): `git rebase --onto release-X main`.

## commit, more confusing terms, and all the rest…

I'll stop there I have nothing to add to [what Julia says on “commit”](https://jvns.ca/blog/2023/11/01/confusing-git-terminology/#commit).

I might actually do a followup post with some of the things she left out.
I'd personally add fork vs. clone too.
