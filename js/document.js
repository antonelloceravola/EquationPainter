'use strict';
/* The two function trees share one history, but keep independent selections. */
EP.Document = class {
  constructor() {
    this.functions = { f: null, g: EP.Model.leaf('x', 'Identity') };
    this.selections = { f: null, g: this.functions.g.id };
    this.active = 'f';
    this.mode = 'modulation';
    this.range = { start: 0, end: 2 * Math.PI };
    this.operator = 'add';
    this.wave = 'square';
    this.past = [];
    this.future = [];
  }
  get root() { return this.functions[this.active]; }
  set root(value) { this.functions[this.active] = value; }
  get selected() { return this.selections[this.active]; }
  set selected(value) { this.selections[this.active] = value; }
  snapshot() {
    return JSON.stringify({ functions: this.functions, selections: this.selections, active: this.active, mode: this.mode, range: this.range });
  }
  checkpoint() {
    this.past.push(this.snapshot());
    if (this.past.length > 80) this.past.shift();
    this.future = [];
  }
  restore(snapshot) { Object.assign(this, JSON.parse(snapshot)); }
  undo() {
    if (!this.past.length) return false;
    this.future.push(this.snapshot());
    this.restore(this.past.pop());
    return true;
  }
  redo() {
    if (!this.future.length) return false;
    this.past.push(this.snapshot());
    this.restore(this.future.pop());
    return true;
  }
  add(node, target, channel = this.active) {
    if (!node) return false;
    let count = 0;
    EP.Model.walk(this.functions[channel], () => count++);
    EP.Model.walk(node, () => count++);
    if (count > 250) return false;
    this.checkpoint();
    this.active = channel;
    const old = target ? EP.Model.find(this.root, target) : this.root;
    const combined = !old || this.operator === 'replace' ? node : EP.Model.binary(this.operator, old, node);
    this.root = target ? EP.Model.replace(this.root, target, combined) : combined;
    this.selected = node.id;
    return true;
  }
  remove() {
    if (!EP.Model.find(this.root, this.selected)) return;
    this.checkpoint();
    this.root = EP.Model.replace(this.root, this.selected, null);
    if (!this.root && this.active === 'g') this.root = EP.Model.leaf('x', 'Identity');
    this.selected = this.root?.id || null;
  }
  reset() {
    this.checkpoint();
    this.root = this.active === 'g' ? EP.Model.leaf('x', 'Identity') : null;
    this.selected = this.root?.id || null;
  }
  setMode(mode) {
    if (!['modulation', 'parametric'].includes(mode) || mode === this.mode) return;
    this.checkpoint();
    this.mode = mode;
  }
  setRange(start, end) {
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !Number.isFinite(end - start)) return false;
    this.checkpoint();
    this.range = { start, end };
    return true;
  }
  circle() {
    this.checkpoint();
    this.functions = { f: EP.Model.leaf('Math.sin(x)', 'Sine'), g: EP.Model.leaf('Math.cos(x)', 'Cosine') };
    this.selections = { f: this.functions.f.id, g: this.functions.g.id };
    this.active = 'f';
    this.mode = 'parametric';
    this.range = { start: 0, end: 2 * Math.PI };
  }
  point(t) {
    return { x: EP.Model.evaluate(this.functions.g, t), y: EP.Model.evaluate(this.functions.f, t) };
  }
  result(x) {
    return EP.Model.evaluate(this.functions.f, EP.Model.evaluate(this.functions.g, x));
  }
  code() {
    const variable = this.mode === 'parametric' ? 't' : 'x';
    const f = this.functions.f ? `(${variable}) => ${EP.Model.code(this.functions.f, variable)}` : 'null';
    const declarations = `const f = ${f};\nconst g = (${variable}) => ${EP.Model.code(this.functions.g, variable)};`;
    return this.mode === 'parametric'
      ? `${declarations}\n\nconst tStart = ${this.range.start};\nconst tEnd = ${this.range.end};\nconst point = (t) => ({ x: g(t), y: f ? f(t) : NaN });`
      : `${declarations}\n\nconst result = (x) => f ? f(g(x)) : NaN;`;
  }
};
