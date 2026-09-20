'use strict';
EP.Model = (() => {
  const colors=['#009b9c','#e18470','#6891ce','#66a577','#a781c8','#d6a059']; let sequence=0;
  const defaults=()=>({a:1,b:0,k:1,p:0,unary:'none'});
  const leaf=(source,name)=>({id:'n'+(++sequence),type:'leaf',source,name:name||source,...defaults(),color:colors[(sequence-1)%colors.length]});
  const binary=(op,left,right)=>({id:'n'+(++sequence),type:'binary',op,left,right,t:.5,...defaults(),color:'#009b9c'});
  function evaluate(n,x) {
    if(!n)return NaN; x=n.k*x+n.p; let v;
    if(n.type==='leaf')v=EP.Math.compile(n.source).eval(x);
    else if(n.op==='inside')v=evaluate(n.left,evaluate(n.right,x));
    else if(n.op==='outside')v=evaluate(n.right,evaluate(n.left,x));
    else {const a=evaluate(n.left,x),b=evaluate(n.right,x);switch(n.op){case 'add':v=a+b;break;case 'subtract':v=a-b;break;case 'multiply':v=a*b;break;case 'divide':v=a/b;break;case 'power':v=a**b;break;case 'blend':v=(1-n.t)*a+n.t*b;break;case 'upper':v=Math.max(a,b);break;case 'lower':v=Math.min(a,b);break;}}
    if(n.unary==='abs')v=Math.abs(v);if(n.unary==='neg')v=-v;if(n.unary==='reciprocal')v=1/v;
    return n.a*v+n.b;
  }
  function code(n,x='x') {
    if(!n)return '0'; let input=x;
    if(n.k!==1)input='('+n.k+' * ('+input+'))';if(n.p!==0)input='('+input+' + ('+n.p+'))';
    let s;if(n.type==='leaf')s=EP.Math.compile(n.source).code(input);
    else if(n.op==='inside')s=code(n.left,code(n.right,input));
    else if(n.op==='outside')s=code(n.right,code(n.left,input));
    else {const a=code(n.left,input),b=code(n.right,input);const ops={add:'+',subtract:'-',multiply:'*',divide:'/',power:'**'};
      if(ops[n.op])s='('+a+' '+ops[n.op]+' '+b+')';
      else if(n.op==='blend')s='(('+ (1-n.t)+' * '+a+') + ('+n.t+' * '+b+'))';
      else s='Math.'+(n.op==='upper'?'max':'min')+'('+a+', '+b+')';}
    if(n.unary==='abs')s='Math.abs('+s+')';if(n.unary==='neg')s='(-('+s+'))';if(n.unary==='reciprocal')s='(1 / ('+s+'))';
    if(n.a!==1)s='('+n.a+' * '+s+')';if(n.b!==0)s='('+s+' + ('+n.b+'))';return s;
  }
  function walk(n,fn,depth=0){if(!n)return;fn(n,depth);if(n.type==='binary'){walk(n.left,fn,depth+1);walk(n.right,fn,depth+1);}}
  function find(n,id){let result;walk(n,a=>{if(a.id===id)result=a;});return result;}
  function replace(n,id,value){if(!n||n.id===id)return value;if(n.type==='binary'){n.left=replace(n.left,id,value);n.right=replace(n.right,id,value);if(!n.left)return n.right;if(!n.right)return n.left;}return n;}
  function clone(n){if(!n)return null;const c=structuredClone(n);walk(c,a=>a.id='n'+(++sequence));return c;}
  function fourier(wave,count,amplitude,period){
    const terms=[];
    for(let i=1;i<=count;i++){
      const harmonic=wave==='sawtooth'?i:2*i-1;
      const coefficient=wave==='square'?4/(Math.PI*harmonic):wave==='sawtooth'?2*(-1)**(i+1)/(Math.PI*i):8*(-1)**(i-1)/(Math.PI**2*harmonic**2);
      const term=leaf('Math.sin(x)','Harmonic '+harmonic);term.a=amplitude*coefficient;term.k=harmonic*(2*Math.PI/period);terms.push(term);
    }
    const root=terms.reduce((a,b)=>a?binary('add',a,b):b,null);root.name=wave[0].toUpperCase()+wave.slice(1)+' · '+count+' terms';return root;
  }
  return {leaf,binary,evaluate,code,walk,find,replace,clone,fourier,colors};
})();
