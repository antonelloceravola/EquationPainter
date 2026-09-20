const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const context = {Math, Map, structuredClone};
context.window = context;
vm.createContext(context);
for (const file of ['math', 'model', 'document']) vm.runInContext(fs.readFileSync(__dirname + '/../js/' + file + '.js', 'utf8'), context);
const {Model:M, Document:D, Math:P} = context.EP;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9, `${a} != ${b}`);
const doc = new D();
assert.equal(doc.functions.f, null);
near(M.evaluate(doc.functions.g, 3.25), 3.25);
doc.add(M.leaf('Math.sin(x)'));
const originalF=JSON.stringify(doc.functions.f);
doc.active='g';doc.operator='replace';doc.add(M.leaf('x ** 2'));
assert.equal(JSON.stringify(doc.functions.f),originalF);
near(doc.result(.4),Math.sin(.16));
doc.active='f';doc.add(M.leaf('Math.cos(x)'));
near(M.evaluate(doc.functions.g,2),4);
near(doc.result(.4),Math.cos(.16));
doc.undo();near(doc.result(.4),Math.sin(.16));
doc.redo();near(doc.result(.4),Math.cos(.16));
// An explicit drop on the inactive G editor targets G only.
doc.operator='add';doc.add(M.leaf('1'),undefined,'g');
near(M.evaluate(doc.functions.g,2),5);near(M.evaluate(doc.functions.f,2),Math.cos(2));
const beforeCircle=doc.snapshot();doc.circle();
for(let i=0;i<=100;i++){const t=i*Math.PI/50,p=doc.point(t);near(p.x*p.x+p.y*p.y,1);}
near(doc.point(0).x,doc.point(2*Math.PI).x);near(doc.point(0).y,doc.point(2*Math.PI).y);
assert.equal(doc.mode,'parametric');doc.undo();assert.equal(doc.snapshot(),beforeCircle);doc.redo();
// Nonzero phase and amplitude on either coordinate remain independent.
doc.functions.g.a=2;doc.functions.f.p=.2;
for(const t of [0,.7,2]){near(doc.point(t).x,2*Math.cos(t));near(doc.point(t).y,Math.sin(t+.2));}
for(const mode of ['modulation','parametric']){
  doc.mode=mode;
  const exported=new Function(doc.code()+'\nreturn '+(mode==='parametric'?'point':'result'))();
  for(const t of [0,.4,2]){if(mode==='parametric'){near(exported(t).x,doc.point(t).x);near(exported(t).y,doc.point(t).y);}else near(exported(t),doc.result(t));}
}
assert.equal(doc.setRange(1,0),false);assert.equal(doc.setRange(0,Infinity),false);assert.equal(doc.setRange(-1e308,1e308),false);
assert.equal(doc.setRange(-Math.PI,Math.PI),true);doc.undo();near(doc.range.end,2*Math.PI);
doc.active='g';doc.reset();near(M.evaluate(doc.functions.g,7),7);assert.ok(doc.functions.f);
doc.active='f';doc.reset();assert.equal(doc.functions.f,null);near(M.evaluate(doc.functions.g,7),7);
assert.ok(Number.isNaN(doc.point(0).y));new Function(doc.code())();
doc.active='g';doc.remove();near(M.evaluate(doc.functions.g,2),2);
near(P.compile('Math.sin(t)').eval(.7),Math.sin(.7));
// Fourier generation uses the active coordinate just like palette drops.
doc.operator='replace';doc.add(M.fourier('triangle',7,1,2*Math.PI));assert.equal(doc.functions.f,null);assert.equal(doc.functions.g.name,'Triangle · 7 terms');
console.log('Passed: independent F/G edits, targeted drops, modulation, circle closure/radius, pair history, coordinate transforms, both exports, parameter validation, reset/removal defaults, t syntax, Fourier targeting.');
