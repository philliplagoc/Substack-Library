# Learning notes

This file holds the questions the developer asked while they built this project,
with short answers. The newest section is at the bottom. No code reads this file.

---

## 2026-08-19 - Milestone 0, Task 1

### What are the three items in the `.gitignore`?

```gitignore
node_modules/
.DS_Store
Thumbs.db
```

| Entry | Why |
|---|---|
| `node_modules/` | The installed dependency tree. `npm install` rebuilds it from `package-lock.json`. A commit of this folder wastes space and makes merge noise. |
| `.DS_Store` | A macOS Finder file. It holds icon positions. |
| `Thumbs.db` | The Windows equivalent. It caches image thumbnails. Windows writes this file on this machine. |

The plan's File Structure block (line 69) shows only `# node_modules`. Task 1
Step 1 gives the correct version. Write all three lines.

### What is `package.json`?

The manifest for a Node project. It sits at the root of a folder. It gives the
name of the project, the list of dependencies, the available commands, and the
module system for the files.

A folder with this file is a Node project. `npm install` looks up the folder
tree for the nearest `package.json`. It then makes `node_modules/` beside it.

Fields in `spike/package.json`:

| Field | What it does |
|---|---|
| `name` | The package identifier. It is a label here, because you do not publish this package. |
| `private: true` | It stops `npm publish`. This guards against an upload to the public registry. |
| `type: "module"` | It sets every `.js` file in the folder to ESM, so `import` and `export` work. Without it, Node reads `.js` as CommonJS and `import` throws a `SyntaxError`. |
| `scripts.test` | It defines what `npm test` runs. Here it runs `node --test`. |

`npm install --save-dev linkedom` (Task 1 Step 3) adds a `devDependencies` block
to this file. Dev dependencies help you develop and test the project. The project
does not need them to run. The `^` in `^0.18.5` accepts a compatible newer
version such as `0.18.6`. It refuses `0.19.0`.

`package-lock.json` appears at the same time. `package.json` gives the intent.
`package-lock.json` records the exact version of each package and sub-package
that npm installed, so a later `npm install` builds the same tree. Commit the
lock file. Do not commit `node_modules/`.

### Why is the test file `.mjs` and `extract.js` a plain script?

`.mjs` marks a file as ESM whatever `package.json` says. Here `type: "module"`
already does that, so the extension is a second guard.

`extract.js` uses no module syntax. It is a plain script that assigns to
`globalThis`, because Task 4 Step 5 pastes it into the DevTools console. The
console cannot run `import` or `export`.

### What is Node?

JavaScript started in the web browser. The language has no command to read a file
or to open a socket. Browsers keep those abilities away from web pages for
security.

Node.js runs the same language outside the browser and adds those abilities. It
bundles V8, the JavaScript engine from Chrome, with access to the operating
system. It gives you a `node` command for the terminal. You install Node once on
the machine. It is not a part of the project.

| | Browser | Node |
|---|---|---|
| Language | JavaScript | JavaScript |
| `document`, `window`, DOM | yes | **no** |
| Read and write files (`node:fs`) | no | yes |
| Command-line arguments, exit codes | no | yes |
| Started by | opening a page | typing `node file.js` |

### Why does the spike need Node, and why `linkedom`?

Task 4 must prove that `extractArticleMeta` reads the correct title from a
Substack page. A check by hand in the console is slow, and it fails when the
author edits the article or the network goes down.

Node reads the frozen fixture from disk instead:

```js
const html = await readFile(new URL(`./fixtures/${file}`, import.meta.url), 'utf8');
```

A browser page cannot read your disk, so only Node can run that line.

Node has no DOM. `extract.js` calls `doc.querySelector(...)`, and Node supplies
no `document` object. `linkedom` fills the gap. It reads a string of HTML and
builds a `Document` in pure JavaScript that answers `querySelector` like a
browser:

```js
return parseHTML(html).document;
```

The same `extract.js` then runs in the console against a live page and in Node
against a saved file.

### What is a Node project?

A folder that Node and `npm` treat as one unit. It holds at minimum:

```
spike/                    <- the project root
  package.json            <- the manifest that marks it a project
  node_modules/           <- the downloaded dependencies (gitignored)
  extract.test.mjs        <- your code
```

`npm` is the package manager that comes with Node. It reads `package.json`,
downloads the dependencies, and runs the named scripts.

The spike is a project inside the repository, not at the repository root. That is
why each command in the plan says `cd spike; npm test`. Run `npm test` from the
repository root and npm finds no `package.json`.

### Why Node 24?

Node 24 has a test runner built in. `node --test` replaces Jest or Vitest, and
the dev dependency list stays at one small library.

```
node --test        <- finds each *.test.mjs file, runs it, prints "# pass N"
```

Check the version before Task 1 Step 3:

```powershell
node --version
```

Install the current LTS from nodejs.org if it prints below `v24`. Older versions
give `--test` a different behavior.

### What is `linkedom`?

An npm package. It builds a DOM from a string of HTML in pure JavaScript, so code
outside a browser can call `querySelector` and read `textContent`.

```js
import { parseHTML } from 'linkedom';

const { document } = parseHTML('<h1 class="title">Hello</h1>');
document.querySelector('.title').textContent;   // 'Hello'
```

It supplies the parts of the DOM that read a document. It omits the parts that
need a browser engine.

| Ability | `linkedom` |
| --- | --- |
| `querySelector`, `getAttribute`, `textContent`, `innerHTML` | Yes |
| `<meta>`, `<script type="application/ld+json">`, `<time datetime>` | Yes |
| Layout, `getComputedStyle`, `getBoundingClientRect` | No |
| Runs `<script>` tags in the page | No |
| Fetches images, styles, or XHR | No |

Three packages do this job at different sizes:

| Package | What it is | Cost |
| --- | --- | --- |
| `cheerio` | jQuery-style selectors over a parse tree. Not a DOM. | Smallest. Browser code does not run against it. |
| `linkedom` | A DOM with the standard property names. | Small and fast. Not a full browser. |
| `jsdom` | A browser simulation. Runs scripts, parses CSS, fires events. | Large and slow. |

The spike takes the middle one. `spike/extract.js` runs in two places: the
DevTools console against a live Substack page, and `node --test` against a saved
fixture. The line `doc.querySelector('h1.post-title')` must work in both.
`cheerio` forces a second version of the code. `jsdom` adds seconds to each test
run and executes the Substack scripts inside the fixture.

The fixtures are frozen HTML files. Nothing in them must run, so the browser
simulation adds no value here.

See also "Why does the spike need Node, and why `linkedom`?" above.

### What is `spike/extract.test.mjs` and what is the point of it?

The automated test file for `spike/extract.js`. The name holds three decisions:

| Part | Meaning |
| --- | --- |
| `extract` | Names the file under test. |
| `.test` | The discovery pattern. `node --test` scans for `*.test.mjs` and `*.test.js`, then runs each match in its own process. |
| `.mjs` | Marks the file as an ES module, so `import` works. |

Task 1 Step 4 puts a smoke test in it. That test checks `linkedom`, not your code:

```js
test('linkedom parses HTML into a Document', () => {
  const { document } = parseHTML('<html><head><title>Hi</title></head><body></body></html>');
  assert.equal(document.title, 'Hi');
});
```

It proves that Node 24 runs, that `npm test` finds the file, that ESM resolves,
and that `linkedom` installed. Find those failures now, before Task 4 adds a
broken selector to the list of suspects.

Task 4 Step 1 replaces it with the fixture harness. The harness reads
`fixtures/manifest.json`, makes one test for each captured article, parses the
frozen HTML with `linkedom`, and compares `extractArticleMeta(doc)` against the
values recorded by hand:

```js
for (const entry of manifest.filter((e) => e.kind === 'article')) {
  test(`extractArticleMeta: ${entry.file}`, async () => {
    const doc = await loadFixture(entry.file);
    const meta = extractArticleMeta(doc);
    assert.equal(meta.title, entry.expected.title);
    // ...
  });
}
```

The `for` loop runs at import time, not inside a test. `node --test` collects
tests while the module executes, so the fixture count sets the test count. Add a
fixture and you get a test. Edit no code.

The point: Substack publishes no API and makes no promise about its HTML. A
renamed CSS class makes the extension save cards with a `null` title, and no
error appears. This file is the tripwire. `npm test` names the fixture and the
field that broke.

The fixtures make that possible. A test against the live site fails when the
author edits the post, when the network drops, or when Substack tries a new
layout. A frozen file changes when you replace it.

An empty `extract.test.mjs` reports `pass 1`. `node --test` counts the file as
one test, and a file that does nothing does nothing without an error. Task 4
Step 2 tells you to run the test before you write `extract.js` and to confirm it
fails with `Cannot find module './extract.js'`. A test you never watched fail can
assert nothing at all.

### What is the DOM?

DOM is short for Document Object Model. HTML on disk is text. The browser reads
that text and builds a tree of objects in memory. The tree is the DOM.

```html
<article>
  <h1 class="post-title">Hello</h1>
  <p>First line.</p>
</article>
```

becomes:

```
article
├── h1.post-title
│   └── #text "Hello"
└── p
    └── #text "First line."
```

Nesting in the text becomes parent and child links in the tree. Each node is an
object with properties such as `textContent` and `className`, and methods such as
`querySelector` and `getAttribute`. `document.querySelector('h1')` searches the
tree and returns a live object.

Two results matter for this project.

The DOM is not the HTML file. The browser downloads the text one time and builds
the tree. After that, JavaScript edits the tree, and the text stays as it was.
Substack sends a near-empty shell and fills the tree with JavaScript, so "View
source" shows little and the DOM holds the article. `spike/capture-fixture.js`
runs in the DevTools console for this reason.

The DOM is also an interface. The name covers the tree and the standard method
names that work on it. Any tool can supply those names.

### What does it mean that `linkedom` builds a DOM from a string of HTML?

A browser does two jobs: it parses text into a tree, then it paints the tree on
the screen. `linkedom` does the first job and skips the second.

```js
import { parseHTML } from 'linkedom';

const { document } = parseHTML('<h1 class="post-title">Hello</h1>');
document.querySelector('.post-title').textContent;   // 'Hello'
```

Give it a string. Get back an object with `querySelector`, `getAttribute`,
`children`, and the other standard names. It paints nothing, opens no window,
runs no script from that HTML, and makes no network request.

Node has no `document` global. Node runs servers and command-line tools, and no
web page exists inside it. Without `linkedom`, this line has no tree to search:

```js
const el = doc.querySelector('h1.post-title');
```

With `linkedom`, `spike/extract.js` runs in two places without an edit. In the
console, `doc` is the browser tree. In `extract.test.mjs`, `doc` is a tree that
`linkedom` built from a fixture file.

### What is an npm package? Is it the same as a Python package?

The idea matches. Someone publishes reusable code to a public registry, you
declare what you want, and a tool downloads it. The vocabulary maps across:

| Python | npm | Job |
| --- | --- | --- |
| PyPI | npm registry | The public index |
| `pip`, `uv` | `npm` | The installer |
| `pyproject.toml` | `package.json` | Declares what you want |
| `uv.lock`, `poetry.lock` | `package-lock.json` | Records what you got |
| `site-packages/` | `node_modules/` | Where the code lands |
| `dependency-groups` | `devDependencies` | Needed to build and test, not to run |
| `import bs4` | `import { parseHTML } from 'linkedom'` | Using it |

Two differences matter.

Isolation is a directory, not a mode you turn on. Python asks you to create a
virtual environment and activate it, and `pip install` hits the system Python
when you forget. npm puts `node_modules/` inside the project folder, and that is
the whole mechanism. Node resolves `import 'linkedom'` by looking for
`./node_modules/linkedom`, then the parent directory, up to the filesystem root.
`spike/node_modules/` is why each command says `cd spike; npm test`.

npm permits two versions of one package in one project. Python allows one
version of `requests` per environment, and two libraries that want different
versions give you a conflict to solve. npm nests instead: package A keeps its
copy in `A/node_modules/`, and package B keeps a different copy. Fewer
conflicts, larger install directories.

The spike shows the second point. One package went into `package.json`:

```
spike/node_modules/
  boolbase       css-what        dom-serializer   domutils   htmlparser2   uhyphen
  css-select     cssom           domelementtype   entities   linkedom
  domhandler     html-escaper    nth-check
```

Fourteen directories. `linkedom` needs `css-select` to match selectors,
`css-select` needs `css-what` to parse selector syntax, and `css-what` needs
`boolbase`. npm walked the graph and installed all of it. `package.json` holds
your intent, one line. `package-lock.json` holds the resolved result, all
fourteen.

`boolbase` contains two functions that return `true` and `false`. It ships as a
separate package. That is why `.gitignore` starts with `node_modules/` and why
you commit the lock file.

`"private": true` in `package.json` blocks `npm publish`. The spike cannot reach
the public registry by accident.

### What is a Fixture Capture Snippet?

Task 2 of the Milestone 0 plan. The name has three words, and each word records
a decision.

**Fixture** is a frozen input for a test. Here it is one Substack page saved as
HTML on disk, in `spike/fixtures/`. The test suite parses that file with
`linkedom`, then asserts that the selectors find the title, the author, and the
paywall state. The file does not change. A test failure then has one meaning:
the extraction code broke.

**Capture** is the act to get that HTML from a live page. Three methods give
three different results:

| Method | Result |
|---|---|
| `Ctrl+U` (view source) | The server shell. Substack adds the article with JavaScript after load, so the shell holds no article text. |
| Save Page As | The article, and also the images, the stylesheets, and the tracking scripts. |
| DevTools console | The finished DOM. The content script reads this same DOM at Milestone 1. |

The plan uses the console.

**Snippet** is a block of JavaScript that you paste into the console by hand. No
module imports `spike/capture-fixture.js`. `npm test` does not run it. It is a
file so that git can hold it and so that you can paste it again for the next
fixture.

The snippet edits `document.documentElement.cloneNode(true)`. It does not edit
the live page. You are signed in, and you read that tab. A change to the real
DOM breaks the page and needs a reload.

The strip list serves two goals. Scripts, `iframe`, and `svg` come out for
safety, because the fixture must stay inert when a tool opens it. Images come
out for size, because a Substack article holds megabytes of images and git keeps
each version.

`script:not([type="application/ld+json"])` is the exception in that list.
JSON-LD is a `<script>` tag that holds metadata. The browser does not execute
it. It is a possible source for the title and the publish date, so `extract.js`
can read it in Task 4.

The `redact(text)` step exists because the fixtures go into git. A signed-in
Substack page shows your display name in the nav bar, your handle in the comment
threads, and your email in the account menu. `redact(text)` walks each text node
and each attribute value, and replaces those strings with `READER`. That
function is the `TODO(human)` in Task 2, Step 2.

The snippet ends with a write to `navigator.clipboard`. A console script cannot
select a save location. The clipboard lets you paste the HTML into
`spike/fixtures/article-free.html` with a name that you choose.

### So what does this have to do with my project?

`implementation-plan.md` lists Substack UI drift as the first risk. It names
four controls: the spike, the isolated parser module, the fixtures, and the
visible failure states. The capture snippet builds the third control.

The extension has no API. Substack gives no contract. Milestone 2, step 1 is a
content script that reads the article metadata. Milestone 3, step 1 is a
saved-list parser. Both read HTML that Substack can restructure at any time. The
card metadata, the reading-time filter, and the Sync Saved import all sit on
selectors that you do not control.

Fixtures make that code testable. A test against a live page needs the network,
your login session, and a paid subscription for the paywall cases. A red result
has two possible causes: Substack changed, or your code changed. A saved
fixture removes each variable except your own code.

The snippet is also a rehearsal for the content script. It runs in the page
context and reads the DOM after JavaScript runs. This is the same environment
that the Milestone 2 content script gets. A selector that works in the console
works in the extension.

The fixtures outlive the spike. You paste `capture-fixture.js` a few times in
Task 3 and Task 5, then never again. The four HTML files stay as the test corpus
for the Milestone 3 parser.

Task 3 asks for three article fixtures. One is not enough. The `Card` model
must know whether an article is readable. Free, paid-subscribed, and
paid-preview are three different DOM shapes. You cannot make the third shape
later without a publication that you do not pay for.

The redaction step follows from the local-first design. A cloud tool keeps its
test pages on a server. This project puts them in a git history, which is
permanent, so your name comes out before the first commit.

### So basically, because there is no Substack API to pull articles from, this is experimenting whether or not I can do that by scraping the web page itself?

The first half is correct. Substack gives no API, so the extension reads the
rendered page. Three points need more precision.

**Scraping is the wrong shape.** A scraper fetches pages from outside. It
carries cookies, it handles CORS, it meets rate limits, and it meets bot
detection. This extension does none of that. `implementation-plan.md` describes
the capture path as a content script that "reads metadata and selections from
the live DOM, no CORS". The code runs inside the tab that you already opened, in
your signed-in session, after Substack renders the page. There is no fetch to
block, no auth to replay, and no request that looks like a robot. This is also
why the fixture comes from the DevTools console and not from `curl`. The console
is the only place that sees the same DOM that the content script sees.

**The extension does not copy article bodies.** The `Card` interface holds
`title`, `author`, `publication`, `url`, `estimatedReadingMinutes`, your
`notes`, and your `quotes`. It has no `body` field. The extension reads the
article text one time to count the words for the reading estimate, then discards
it. The article stays on Substack. You keep a pointer and your own writing.

**The spike asks a narrower question than "can I".** The data is in the DOM. You
can see it in the Elements panel now. Two things are unknown: which selectors
are stable, and how many page shapes exist. `h1.post-title` can hold for years,
or it can be a build-hash class that changes next month. A paid preview can use
a different container than a free post. The spike answers both questions and
freezes the evidence, so a future change shows as a named test failure.

The in-page design has a licensing effect. A scraper that pulls paywalled
articles from outside is a different act from an extension that reads a page
which a paying subscriber already loaded. The missing `body` field keeps this
project in the second category.

`estimatedReadingMinutes?` is optional. Its comment reads "blank when the body
is unreadable". That `?` is the reason Task 3 needs the paid-preview fixture. It
is the only page shape that exercises the blank branch.

### I still kind of don't get why `capture-fixture.js` exists and its purpose. What problem are we trying to solve right now? And why this method instead of other methods?

The spike has two halves. `capture-fixture.js` is a camera. `extract.js` is a
reader. Task 2 builds the camera, because Task 4 cannot test the reader without
a photograph.

**The problem.** You want code that looks at a Substack page and reports the
title and the author. To know that the code works, you must show it a page and
check the answer. There are two sources for that page.

| Source | Result |
|---|---|
| The live substack.com | The test goes red one morning. The author fixed a typo, or the network dropped, or the session expired, or Substack shipped a redesign, or your code broke. The signal names no cause. |
| A page saved to disk | The file changes only when you replace it. A red test has one cause: your code broke. |

The saved page is a **fixture**. Task 2 makes the tool that captures it. Task 3
runs that tool four times. Task 4 writes the reader and tests it against the
four files. The fixtures then stay as the test corpus for the Milestone 2 and
Milestone 3 parsers.

**Why the DevTools console.** Four ways exist to get HTML off a page. Three fail
here.

| Method | What you get | Why it fails |
|---|---|---|
| `Ctrl+U`, `curl`, `fetch` | The file the server sent | Substack sends a near-empty shell and builds the article with JavaScript. The shell holds no title. `curl` also carries no login, so paid pages come back locked. |
| `Ctrl+S`, Save Page As | The article, the images, the stylesheets, the tracking scripts, and your name | Megabytes per file in git, and live scripts inside a test fixture. |
| DevTools console | The finished DOM, after JavaScript ran, in your signed-in session | Nothing. The plan uses this method. |

The console wins for a second reason. Milestone 2 runs a content script inside
the page. A content script sees the finished DOM in your signed-in session. The
console gives that same view. A selector that works in the console also works in
the extension, so the capture doubles as a rehearsal for the content script.

**Why the snippet strips the page.** It clones the document first, then removes
things for three separate reasons.

| Step | Reason |
|---|---|
| Remove `script`, `iframe`, `svg`, `noscript` | Safety. The fixture must stay inert when a tool opens it. |
| Remove `img`, `picture`, `source` | Size. Git keeps every version of every file. |
| Remove `on*` and `data-track*` attributes | Safety. `onclick` holds code inside an attribute. |
| `redact(text)` | Privacy. A signed-in page shows your display name in the nav, your handle in the comment threads, and your email in the account menu. |

`script:not([type="application/ld+json"])` is the exception in that list. JSON-LD
is a `<script>` tag that holds metadata, and the browser never executes it. It is
a possible source for the title and the publish date, so Task 4 can read it.

Line 11 reads `document.documentElement.cloneNode(true)`. The snippet strips a
copy. You are signed in and you read that tab, and an edit to the real DOM
breaks the page under you.

See also "What is a Fixture Capture Snippet?" above for the three words in the
task name.

### What does `redact()` do in `spike/capture-fixture.js` and why is it needed?

`redact(text)` takes a string, finds every private string inside it, and swaps
each one for the word `READER`.

```js
function redact(text) {
  if (!text || PRIVATE_STRINGS.length === 0) return text;
  const escaped = PRIVATE_STRINGS.map((s) => s.replace(/[.*+?^${}()|[\]\]/g, '\$&'));
  const pattern = new RegExp(escaped.join('|'), 'gi');
  return text.replace(pattern, 'READER');
}
```

| Line | What it does |
|---|---|
| The guard | Hands back empty string, `null`, and `undefined` untouched. The plan asked for no throw on empty input. |
| `escaped` | Turns each private string into a literal. An email holds `.` and `@`. In a regex `.` means "any character", so an unescaped `you@gmail.com` also matches `you@gmailXcom`. `$&` means "the character you just matched", so `.` becomes `\.`. |
| `pattern` | Joins the escaped strings with `\|` into one pattern: name OR handle OR email. `g` replaces every occurrence instead of the first. `i` catches `PHILLIP LAGOC` in a heading. |
| `text.replace` | Returns a new string. `String.replace` never edits in place. |

Three reasons the snippet needs it.

| Reason | Detail |
|---|---|
| Privacy | You capture the fixture while signed in. The nav bar holds your display name, comment threads hold your `@handle`, and the account menu and the embedded JSON blobs hold your email. |
| Permanence | You commit the fixtures. Git keeps every version of every file, so deleting an email later leaves it in the history. The snippet has to redact before the HTML reaches the clipboard. |
| A stable corpus | Every fixture says `READER`. Tasks 3 and 4 assert against those files, and the fixed token keeps the assertions independent of who captured the page. |

The snippet runs `redact()` over text nodes and over attribute values. That
second loop catches what the tree walker cannot reach. Your name also sits in
`alt="Phillip Lagoc"`, `title=`, `href="/@philliplagoc"`, and `data-*` payloads,
and a text-node walker visits none of those.

Building a regex out of data is the classic injection shape. The data here is
yours, so a bad escape costs you a wrong match rather than an attack, but the
escaping habit is the one that also stops SQL injection.

The regex engine matches alternatives leftmost-first. Three separate `replace()`
calls scan the string three times, and each pass can match text the previous
pass wrote. One `a|b|c` pattern makes a single sweep, so it never re-matches
`READER`. If you add both `Phillip` and `Phillip Lagoc` later, put the longer
one first, or `Phillip` wins and ` Lagoc` survives into the fixture.

### Do you mean paste the whole script into the Console tab of Substack? And then this would "take a picture" of the article so I can process later?

Yes to both. Three corrections.

**Paste the whole file.** `F12`, then the **Console** tab, then paste every line
of `spike/capture-fixture.js`, then Enter. The wrapper defines the function and
calls it in one expression:

```js
(async function captureFixture() {
  // ...
})();   // <- these parens run it
```

The file ended `})` at first. That defines an anonymous function and calls
nothing, so the console prints the function back at you and the clipboard stays
empty. The `();` at the end is the call.

**Not Substack yet.** Step 3 is a rehearsal on any article page, with
`PRIVATE_STRINGS` set to `['the']`. You prove the plumbing works: the clipboard
write succeeds, `the` is gone from the output, `READER` is everywhere. Substack
comes in Task 3, after you swap in your real name, handle, and email.

**The output is HTML text.**

| Approach | What you get | Can a test parse it? |
|---|---|---|
| Screenshot | Pixels | No |
| `Ctrl+S` save page | Files, images, scripts, megabytes | Awkwardly |
| `Ctrl+U` view source | Substack's empty shell | Nothing to parse |
| This snippet | The rendered DOM as HTML, stripped and redacted | Yes |

Substack ships an empty HTML shell and builds the article with JavaScript, so
view-source shows you almost nothing. The console sees the finished DOM. So does
a content script, which is what Milestone 2 writes, so the fixture matches what
the real extension will read.

The HTML lands on your clipboard, not on disk. You paste it into
`spike/fixtures/article-free.html` yourself in Task 3, Step 5. Task 4 parses that
frozen file with `linkedom`. The article stops changing, so the tests stop
depending on Substack's servers or on your login.

One more guarantee. The snippet copies the page before it touches anything:

```js
const clone = document.documentElement.cloneNode(true);
```

Every `remove()` and `setAttribute()` after that line runs on the copy. The live
page never changes, so you can run the snippet twice without reloading.

### Why did the snippet fail with `Document is not focused`?

Picture the clipboard as one notepad on a shared desk. Chrome enforces a rule
about it: you may write on the notepad only while you sit at that desk.

Click **Run** on a DevTools snippet and you sit in DevTools. The article page
waits next door. So the last line of the snippet failed:

```js
await navigator.clipboard.writeText(html);
```

`Document is not focused` means the page is not the window you are looking at.
The rule exists to stop a background tab from overwriting the password you
copied a second ago. Chrome breaks your snippet rather than allow that.

Every line above it worked. The clone, the stripped scripts, the deleted images,
the redaction. One step failed, and because it failed inside an `async` function
with no `.catch()` around it, Chrome printed:

```
Uncaught (in promise) NotAllowedError
```

That prefix always means the same thing: a promise rejected and nobody was
listening.

Three ways out:

| Fix | How it works | Cost |
|---|---|---|
| Click the page, then re-run | Focus returns to the article | Fails again the moment you touch DevTools |
| `copy(html)` | A DevTools helper that skips the focus rule | Lives only in DevTools, chokes on large strings |
| Blob download | Build a file in memory, click a hidden link | None worth mentioning |

The snippet takes the third route:

```js
const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
const link = document.createElement('a');
link.href = blobUrl;
link.download = slug + '.html';
link.click();
```

A `Blob` is a pile of bytes plus a label saying "this is HTML".
`URL.createObjectURL()` hands that pile a temporary address, `blob:https://...`,
which points at memory inside this tab. The `download` attribute tells Chrome to
save the address instead of opening it. No focus check, no size limit.

```js
setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
```

Revoking the address frees the memory. Skip that call and the tab holds a second
copy of the page until you close it.

The file lands in Downloads named after the article slug. Move it into
`spike/fixtures/` and Task 4 parses it.

| | Before | After |
|---|---|---|
| Where the HTML goes | Clipboard | Downloads folder |
| Needs the page focused | Yes | No |
| Size limit | Clipboard struggles past a few hundred KB | None |
| Your next step | Paste into a new file | Drag the file into `spike/fixtures/` |

You meet `blob:` again in Milestone 5. Exporting notes as Markdown uses this
same shape: build a string, wrap it in a `Blob`, click a link you made in code.

### I do not pay for any Substack publications. Can paid subscriptions be a future feature?

Yes. I dropped the fixture you cannot make, kept the one you can, and wrote the
subscription work into the plan for later.

The plan named three article page kinds. You can open two of them.

| Fixture | What it is | Can you capture it? |
|---|---|---|
| `article-free.html` | A free article | Yes |
| `article-paid-subscribed.html` | A paid article you paid to read | No |
| `article-paywalled.html` | A paid article you did not pay for | Yes. Opening the page costs nothing. |

Keep the paywalled page, because reading time is `words / 250` and a paywalled
page shows a teaser of about 90 words. Skip the paywall check and the card reads
"1 min read" for an article you cannot open. `isPreview` in `extract.js` catches
that case.

Drop the subscribed page. Milestone 0 ends when every fixture exists and every
table cell holds a value. You cannot check off a step that needs money you do
not want to spend, so the milestone would sit open.

Read "Deferred to a later version" in the plan. If you subscribe one day,
capture the page, add a manifest entry, and run `npm test`. If the read paths
match the free article, you write no new code.

## 2026-08-21 - Milestone 0, Task 3

### I only care about reading free articles. Would I only need `article-free`?

No. Keep `article-paywalled.html`. The plan cut one job: reading the body of a
paid article you subscribe to. It kept a second job: spotting a paywall when you
land on one.

Think of a bouncer at a door. You never enter the paid club. The bouncer must
know what the closed door looks like, so they can tell you "this one is closed
to you" before you walk into a hallway with one poster in it.

| Job | In v1? | Fixture |
|---|---|---|
| Read a free article body | Yes | `article-free.html` |
| Spot a paywall and mark the card | Yes | `article-paywalled.html` |
| Read a paid article body as a subscriber | No | None. Deferred. |

One day you save a link from Notes and the article turns out to be paywalled.
Without the paywall check, `extract.js` counts the ~90-word teaser and the board
shows a "1 min read" card for an article you cannot open. The `isPreview: true`
test in Task 4 runs against `article-paywalled.html`. Drop the fixture and that
test has nothing to parse.

The capture costs a few minutes and no money. Open a paid article you did not
buy and run the snippet.
