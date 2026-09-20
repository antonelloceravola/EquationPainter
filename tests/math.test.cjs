const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={window:{},Math,Map,structuredClone};context.window=context;vm.createContext(context);for(const file of ['math','model'])vm.runInContext(fs.readFileSync(__dirname+'/../js/'+file+'.js','utf8'),context);const {Math:P,Model:M}=context.EP;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} ≠ ${b}`);
near(P.compile('Math.sin(x) + x ** 2').eval(.7),Math.sin(.7)+.49);near(P.compile('2 ** 3 ** 2').eval(0),512);near(P.compile('-x ** 2').eval(3),-9);near(P.compile('Math.max(x, 2)').eval(3),3);
for(const bad of ['alert(1)','x.constructor','window','Math.random()','x; x','x ^ 2','Math.sin(x, 2)','2x'])assert.throws(()=>P.compile(bad));
const f=M.leaf('Math.sin(x)'),g=M.leaf('x ** 2');near(M.evaluate(M.binary('inside',f,g),.4),Math.sin(.16));near(M.evaluate(M.binary('outside',f,g),.4),Math.sin(.4)**2);
for(const op of ['add','subtract','multiply','divide','inside','outside','power','blend','upper','lower']){const n=M.binary(op,M.leaf('Math.sin(x)'),M.leaf('x ** 2'));n.a=2;n.b=.7;n.k=1.3;n.p=-.2;for(const x of [.6,1,2]){const expected=M.evaluate(n,x),generated=new Function('x','return '+M.code(n))(x);if(Number.isNaN(expected))assert.ok(Number.isNaN(generated));else near(expected,generated);}}
for(const wave of ['square','sawtooth','triangle']){const n=M.fourier(wave,7,2,2*Math.PI);let leaves=0;M.walk(n,node=>{if(node.type==='leaf')leaves++;});assert.equal(leaves,7);near(M.evaluate(n,0),0);near(M.evaluate(n,.6),-M.evaluate(n,-.6));near(M.evaluate(n,.6),M.evaluate(n,.6+2*Math.PI));}
near(M.evaluate(M.fourier('square',1,1,2*Math.PI),Math.PI/2),4/Math.PI);near(M.evaluate(M.fourier('triangle',32,1,2*Math.PI),Math.PI/2),Array.from({length:32},(_,i)=>8/(Math.PI**2*(2*i+1)**2)).reduce((a,b)=>a+b,0));
const root=M.binary('add',f,g);assert.equal(M.replace(root,g.id,null),f);assert.notEqual(M.clone(f).id,f.id);assert.ok(!Number.isFinite(M.evaluate(M.binary('divide',M.leaf('1'),M.leaf('x')),0)));
console.log('Passed: parser restrictions, precedence, all 10 binary operators, serialization, transforms, Fourier symmetry/periodicity/coefficients, tree editing, undefined domains.');
