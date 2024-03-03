/* playground-fold */
import "https://unpkg.com/construct-style-sheets-polyfill";
import "https://unpkg.com/element-internals-polyfill";
/* playground-fold-end */

const styles = new CSSStyleSheet();
styles.replace(/* playground-fold *//*css*/`
:host {
    display: inline-block;
    vertical-align: text-bottom;
}
:host([hidden]) {
    display: none;
}
#tile {
    text-transform: uppercase;
    border: 2px solid;
    min-width: 2em;
    min-height: 2em;
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    --outline-width: 1px;
    --outline-offset: 1px;
    margin: calc(var(--outline-width) + var(--outline-offset));
}
/* Placeholder tile */
#tile:empty {
    background-color: var(--tile-bg-empty, white);
    border-color: var(--tile-fg-empty, darkgray);
    color: var(--tile-text-empty, darkgray);
}
/* Unevaluated tile */
#tile:not(:empty) {
    background-color: var(--tile-bg-empty, white);
    border-color: var(--tile-fg-empty, gray);
    color: var(--tile-text-empty, gray);
}
/* Current tile (must be empty) */
:host([state=current i]) #tile:empty {
    background-color: var(--tile-bg-current, white);
    border-color: var(--tile-fg-current, gray);
    color: var(--tile-text-current, gray);
    outline-offset: var(--outline-offset);
    outline: var(--outline-width) solid;
}
@media (prefers-reduced-motion: no-preference) {
    :host([state=current i]) #tile:empty {
        animation: blink .7s linear infinite alternate;
    }
    @keyframes blink {
        from {
            outline-color: transparent;
        }
    }
}
/* Correct tile (must be non-empty) */
:host([state=correct i]) #tile:not(:empty) {
    background-color: var(--tile-bg-correct, green);
    border-color: var(--tile-fg-correct, green);
    color: var(--tile-text-correct, white);
}
/* Present tile (must be non-empty) */
:host([state=present i]) #tile:not(:empty) {
    background-color: var(--tile-bg-present, orange);
    border-color: var(--tile-fg-present, orange);
    color: var(--tile-text-present, white);
}
/* Absent tile (must be non-empty) */
:host([state=absent i]) #tile:not(:empty) {
    background-color: var(--tile-bg-absent, darkgray);
    border-color: var(--tile-fg-absent, darkgray);
    color: var(--tile-text-absent, white);
}
`/* playground-fold-end */);

class Tile extends HTMLElement {
    #internals;
    #tile = this.ownerDocument.createElement("div");
    #mutationObserver = new MutationObserver(() => {
        this.#tile.textContent = this.letter;
        this.#updateState();
    });

    constructor() {
        super();
        this.#internals = this.attachInternals();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.adoptedStyleSheets = [ styles ];
        this.shadowRoot.appendChild(this.#tile);
        this.#tile.id = "tile";
        this.#mutationObserver.observe(this, { childList: true, characterData: true, subtree: true });
        this.#unshadowProperties("letter", "state");
        this.#tile.textContent = this.letter;
        this.#updateState();
    }

    #unshadowProperties(...props) {/* playground-fold */
        for (let prop of props) {
            if (Object.hasOwn(this, prop)) {
                let value = this[prop];
                delete this[prop];
                this[prop] = value;
            }
        }
    /* playground-fold-end */}

    static get observedAttributes() { return ["state"]; }
    attributeChangedCallback(name, oldValue, newValue) {
        this.#updateState();
    }

    get letter() {
        let letter = this.textContent.trim();
        if (letter) {
            letter = String.fromCodePoint(letter.codePointAt(0));
        }
        return letter;
    }
    set letter(letter) {
        this.textContent = letter;
    }

    get state() {
        let state = (this.getAttribute("state") || "").trim().toLowerCase();
        switch (state) {
            case "current":
            case "correct":
            case "present":
            case "absent":
                return state;
            default:
                return "";
        }
    }
    set state(state) {
        state ? this.setAttribute("state", state) : this.removeAttribute("state");
    }

    #updateState() {
        this.#internals.states.clear();
        if (!this.letter) {
            if (this.state == "current") {
                this.#internals.states.add("--current");
            } else {
                this.#internals.states.add("--placeholder");
            }
        } else {
            switch (this.state) {
                case "current":
                    this.#internals.states.add("--current");
                    // fall-through
                case "":
                    this.#internals.states.add("--unevaluated");
                    break;
                case "correct":
                    this.#internals.states.add("--evaluated");
                    this.#internals.states.add("--correct");
                    break;
                case "present":
                    this.#internals.states.add("--evaluated");
                    this.#internals.states.add("--present");
                    break;
                case "absent":
                    this.#internals.states.add("--evaluated");
                    this.#internals.states.add("--absent");
                    break;
            }
        }
    }
}
customElements.define("wordle-tile", Tile);
