/* playground-fold */import "https://unpkg.com/construct-style-sheets-polyfill";/* playground-fold-end */

import("./wordle-tile.js"); // asynchronous

const styles = new CSSStyleSheet();
styles.replace(/* playground-fold *//*css*/`
:host {
    display: block;
}
:host([hidden]) {
    display: none;
}
#row {
    display: flex;
}
wordle-tile {
    flex: 1;
}
`/* playground-fold-end */);

const DEFAULT_LENGTH = 5;
const DEFAULT_TILE_ELEMENT = "wordle-tile";
const EVALUATIONS = Object.freeze(new Set("correct", "present", "absent"));

class Row extends HTMLElement {
    #row = this.ownerDocument.createElement("div");
    #mutationObserver = new MutationObserver(() => {
        this.#updateGuess();
    });
    #pendingUpdate = false;

    #length = DEFAULT_LENGTH;
    #letters = [];
    #evaluations = [];
    #tileElementName = DEFAULT_TILE_ELEMENT;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.adoptedStyleSheets = [ styles ];
        this.shadowRoot.appendChild(this.#row);
        this.#row.id = "row";
        this.#mutationObserver.observe(this, { childList: true, characterData: true, subtree: true });
        this.#unshadowProperties(this, "length", "current", "guess", "evaluations", "tileElementName");
        // Make sure that, at a minimum, the default length is applied
        this.#requestUpdate();
    }

    #unshadowProperties(...props) {/* playground-fold */
        let hasOwnProperty = Object.prototype.hasOwnProperty.bind(this);
        for (let prop of props) {
            if (hasOwnProperty(prop)) {
                let value = this[prop];
                delete this[prop];
                this[prop] = value;
            }
        }
    /* playground-fold-end */}

    static get observedAttributes() { return [ "length", "current", "evaluations", "tile-element" ]; }
    attributeChangedCallback(name, oldValue, newValue) {
        switch (name) {
            case "length":
                // https://html.spec.whatwg.org/multipage/common-dom-interfaces.html#limited-to-only-non-negative-numbers-greater-than-zero
                let length = newValue == null ? DEFAULT_LENGTH : parseInt(newValue, 10);
                if (Number.isNaN(length) || length <= 0) {
                    length = DEFAULT_LENGTH;
                }
                if (length !== this.#length) {
                    this.#length = length;
                    this.#requestUpdate();
                }
                break;
            case "current":
                // Only care about adding or removing the attribute
                if (oldValue == null || newValue == null) {
                    this.#requestUpdate();
                }
                break;
            case "evaluations":
                newValue = (newValue || "").trim();
                let evaluations = newValue === "" ? [] : newValue.toLowerCase().split(/\s+/g);
                if (!evaluations.every(e => EVALUATIONS.has(e))) {
                    evaluations = [];
                }
                if (!arrayEqual(this.#evaluations, evaluations)) {
                    this.#evaluations = evaluations;
                    // Only re-render if evaluations are "long" enough
                    if (evaluations.length >= this.#length) {
                        this.#requestUpdate();
                    }
                }
                break;
            case "tile-element":
                let tileElementName = String(newValue || DEFAULT_TILE_ELEMENT).toLowerCase();
                // validate the element name by attempting to create one
                try {
                    this.ownerDocument.createElement(tileElementName);
                } catch (e) {
                    tileElementName = DEFAULT_TILE_ELEMENT;
                }
                if (tileElementName !== this.#tileElementName) {
                    this.#tileElementName = tileElementName;
                    // force re-creation of all the tiles by removing them all
                    this.#row.textContent = "";
                    this.#requestUpdate();
                }
                break;
        }
    }

    get length() {
        return this.#length;
    }
    set length(value) {
        // https://webidl.spec.whatwg.org/#es-unsigned-long
        value = Number(value);
        if (!Number.isFinite(value)) {
            value = DEFAULT_LENGTH;
        }
        // WebIDL says sign(value) * floor(abs(value)),
        // but because we're only interested in strictly positive values,
        // we can simplify to just floor()
        value = Math.floor(value);
        // https://html.spec.whatwg.org/multipage/common-dom-interfaces.html#limited-to-only-non-negative-numbers-greater-than-zero
        if (value === 0) {
            throw new DOMException(`Failed to set the 'length' property on '${this[Symbol.toStringTag]}': The value provided (${value}) is not positive.`, "IndexSizeError");
        }
        if (value < 1) {
            value = DEFAULT_LENGTH;
        }
        this.setAttribute("length", value);
    }

    get current() {
        return this.hasAttribute("current");
    }
    set current(value) {
        this.toggleAttribute("current", value);
    }

    #updateGuess() {
        let letters = [...this.textContent.trim()];
        if (!arrayEqual(this.#letters, letters)) {
            this.#letters = letters;
            this.#requestUpdate();
        }
    }
    get guess() {
        return this.#letters.slice(0, this.length).join('');
    }
    set guess(value) {
        this.textContent = value;
    }

    get evaluations() {
        let evaluations = (this.getAttribute("evaluations") || "")
            .trim().split(/\s+/g).slice(0, this.length);
        if (evaluations.every(e => ["correct", "present", "absent"].includes(e))) {
            return evaluations;
        }
        return [];
    }
    set evaluations(value) {
        if (Array.isArray(value)) {
            value = value.join(' ');
        }
        this.setAttribute("evaluations", value);
    }

    get tileElementName() {
        return this.#tileElementName;
    }
    set tileElementName(value) {
        this.setAttribute("tile-element", value);
    }

    #requestUpdate() {
        if (this.#pendingUpdate) return;
        this.#pendingUpdate = true;
        queueMicrotask(() => {
            try {
                this.#update();
            } finally {
                this.#pendingUpdate = false;
            }
        });
    }
    #update() {
        // ensure there's as many tiles as the 'length'
        while (this.#row.childElementCount < this.length) {
            let tile = this.#row.appendChild(this.ownerDocument.createElement(this.tileElementName));
            tile.part.add("tile");
        }
        while (this.#row.childElementCount > this.length) {
            this.#row.lastElementChild.remove();
        }

        let tiles = Array.from(this.#row.children);
        let letters = this.#letters;
        if (this.current) {
            // current row
            tiles.forEach((tile, i) => {
                tile.letter = letters[i];
                tile.state = (i == letters.length) ? "current" : null;
            });
            return;
        }
        let evaluations = this.evaluations;
        if (letters.length === tiles.length && evaluations.length == letters.length) {
            // evaluated row
            tiles.forEach((tile, i) => {
                tile.letter = letters[i];
                tile.state = evaluations[i];
            });
            return;
        }
        // empty row
        for (let tile of tiles) {
            tile.letter = null;
            tile.state = null;
        }
    }
}
customElements.define("wordle-row", Row);

function arrayEqual(arr1, arr2) {
    return arr1.length === arr2.length &&
        arr1.every((v, i) => arr2[i] === v);
}
