/* A small math-only parser. User expressions never execute as JavaScript. */
'use strict';
window.EP = window.EP || {};
EP.Math = (() => {
  const functions = Object.fromEntries(['sin','cos','tan','abs','sqrt','exp','log','log2','log10','floor','ceil','round','min','max','pow','sign','asin','acos','atan','atan2','sinh','cosh','tanh'].map(k => [k, Math[k]]));
  const cache = new Map();
  function parse(source) {
    if (!source.trim() || source.length > 500) throw Error('Enter a math expression of 1–500 characters.');
    const tokens = []; let pos = 0;
    const re = /\s*(?:(\d*\.\d+(?:e[+-]?\d+)?|\d+(?:\.\d*)?(?:e[+-]?\d+)?)|((?:Math\.)?[A-Za-z][A-Za-z0-9]*)|(\*\*|[+\-*/%(),]))/iy;
    while (pos < source.length) {
      if (!source.slice(pos).trim()) break;
      re.lastIndex = pos; const m = re.exec(source);
      if (!m) throw Error('Unexpected character at position ' + (pos + 1) + '. Use ** for powers.');
      tokens.push(m[1] ? {type:'number', value:Number(m[1])} : {type:m[2] ? 'name' : 'op',value:m[2] || m[3]}); pos = re.lastIndex;
    }
    let i = 0;
    const peek = () => tokens[i]?.value;
    function take(value) { if (peek() !== value) throw Error('Expected “' + value + '”.'); i++; }
    function expr(min = 0) {
      const token = tokens[i++]; if (!token) throw Error('The expression is incomplete.');
      let left;
      if (token.type === 'number') left = {type:'number',value:token.value};
      else if (token.value === '-' || token.value === '+') left = {type:'unary',op:token.value,arg:expr(25)};
      else if (token.value === '(') {left = expr(); take(')');}
      else if (token.type === 'name') {
        const name = token.value.replace(/^Math\./,'');
        if (name === 'x' || name === 't') left = {type:'x'};
        else if (name === 'PI' || name === 'E') left = {type:'number',value:Math[name]};
        else if (functions[name]) {
          take('('); const args = [expr()]; while(peek() === ',') {i++;args.push(expr());} take(')');
          const arity = ['pow','atan2'].includes(name) ? 2 : ['min','max'].includes(name) ? null : 1;
          if (arity && args.length !== arity) throw Error(name + ' needs ' + arity + ' argument(s).');
          left = {type:'call',name,args};
        } else throw Error('Unknown name “' + token.value + '”. Use x or a supported Math function.');
      } else throw Error('Expected a number, x, or a function.');
      const precedence = {'+':10,'-':10,'*':20,'/':20,'%':20,'**':30};
      while (precedence[peek()] !== undefined && precedence[peek()] >= min) {
        const op = tokens[i++].value, right = expr(precedence[op] + (op === '**' ? 0 : 1));
        left = {type:'binary',op,left,right};
      }
      return left;
    }
    const ast = expr(); if (i !== tokens.length) throw Error('Unexpected token “' + peek() + '”. Use * for multiplication.'); return ast;
  }
  function evaluate(n,x) {
    if(n.type==='number') return n.value;
    if(n.type==='x') return x;
    if(n.type==='unary') return (n.op==='-'?-1:1)*evaluate(n.arg,x);
    if(n.type==='call') return functions[n.name](...n.args.map(a=>evaluate(a,x)));
    const a=evaluate(n.left,x),b=evaluate(n.right,x);
    return n.op==='+'?a+b:n.op==='-'?a-b:n.op==='*'?a*b:n.op==='/'?a/b:n.op==='%'?a%b:a**b;
  }
  function stringify(n,x='x') {
    if(n.type==='x')return '('+x+')';
    if(n.type==='number')return String(n.value);
    if(n.type==='unary')return '('+n.op+stringify(n.arg,x)+')';
    if(n.type==='call')return 'Math.'+n.name+'('+n.args.map(a=>stringify(a,x)).join(', ')+')';
    return '('+stringify(n.left,x)+' '+n.op+' '+stringify(n.right,x)+')';
  }
  function compile(source) { if(!cache.has(source)){const ast=parse(source);cache.set(source,{eval:x=>evaluate(ast,x),code:x=>stringify(ast,x)});}return cache.get(source); }
  return {parse,compile};
})();
