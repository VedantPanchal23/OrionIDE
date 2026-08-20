/**
 * Lightweight Y.Text ↔ Monaco model sync (avoids y-monaco pulling a second Monaco).
 */

/**
 * @param {import('yjs').Text} ytext
 * @param {import('monaco-editor').editor.ITextModel} model
 * @param {Set<any>} editors
 */
export class SimpleMonacoBinding {
  constructor(ytext, model, editors = new Set()) {
    this.ytext = ytext;
    this.model = model;
    this.editors = editors;
    this._mux = false;
    this._disposables = [];

    // After provider sync: if shared doc empty, seed once from local buffer
    if (ytext.length === 0) {
      const local = model.getValue();
      if (local) {
        this._mux = true;
        try {
          ytext.insert(0, local);
        } finally {
          this._mux = false;
        }
      }
    } else if (ytext.toString() !== model.getValue()) {
      this._mux = true;
      try {
        model.setValue(ytext.toString());
      } finally {
        this._mux = false;
      }
    }

    this._onY = (event, transaction) => {
      if (this._mux) return;
      // Skip our own writes (origin === this)
      if (transaction.origin === this) return;
      this._mux = true;
      try {
        const next = this.ytext.toString();
        if (this.model.getValue() !== next) this.model.setValue(next);
      } finally {
        this._mux = false;
      }
    };
    ytext.observe(this._onY);

    this._disposables.push(
      model.onDidChangeContent(() => {
        if (this._mux) return;
        const next = this.model.getValue();
        if (next === this.ytext.toString()) return;
        this._mux = true;
        try {
          this.ytext.doc.transact(() => {
            this.ytext.delete(0, this.ytext.length);
            if (next) this.ytext.insert(0, next);
          }, this);
        } finally {
          this._mux = false;
        }
      }),
    );
  }

  destroy() {
    try { this.ytext.unobserve(this._onY); } catch { /* ignore */ }
    this._disposables.forEach((d) => { try { d.dispose(); } catch { /* ignore */ } });
    this._disposables = [];
  }
}
