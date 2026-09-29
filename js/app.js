'use strict';
(() => {
  const $=id=>document.getElementById(id),M=EP.Model;
  const operations=[['add','+','Add'],['subtract','−','Subtract'],['multiply','×','Multiply'],['divide','÷','Divide'],['inside','( )','Inside'],['outside','[ ]','Outside'],['power','xʸ','Power'],['blend','◉','Blend'],['upper','↑','Upper'],['lower','↓','Lower'],['replace','⇄','Replace']];
  const state=new EP.Document();
  const selected=()=>M.find(state.root,state.selected);
  const plot=new EP.Plot($('plot'),(x,y)=>$('coordinates').textContent='x: '+x.toFixed(3)+'    y: '+y.toFixed(3));
  const notify=text=>$('status').textContent=text;
  const snapshot=()=>state.snapshot();
  const checkpoint=()=>state.checkpoint();
  function undo(){if(state.undo()){render();plot.fit();notify('Undone');}}
  function redo(){if(state.redo()){render();plot.fit();notify('Redone');}}
  function add(node,target,channel=state.active){
    if(!node)return;
    if(!state.add(node,target,channel)){notify('Expression limit reached. Remove some parts first.');return;}
    render();notify('Added '+(node.name||'function')+' to '+channel.toUpperCase()+' · '+operations.find(o=>o[0]===state.operator)[2]);
  }
  const palette=new EP.Palette(add);
  operations.forEach(([key,symbol,label])=>{const b=document.createElement('button');b.innerHTML='<span>'+symbol+'</span>'+label;b.dataset.operation=key;b.setAttribute('aria-pressed',key==='add');b.title=key==='inside'?'current(dropped(input)): compose inside the active editor':key==='outside'?'dropped(current(input)): compose outside the active editor':label+' the next dropped function';b.onclick=()=>{state.operator=key;document.querySelectorAll('[data-operation]').forEach(x=>x.setAttribute('aria-pressed',x===b));$('drop-operation').textContent=label.toLowerCase();notify(label+' selected for the next drop');};$('operators').append(b);});
  function select(id,channel=state.active){state.active=channel;state.selected=id;render();}
  function nodeTitle(n){if(n.type==='leaf')return n.name||n.source;return n.name||operations.find(o=>o[0]===n.op)?.[2]+' group';}
  function short(n){if(n.type==='leaf'){let text=n.source.replace(/\bt\b/g,'x');if(n.k!==1||n.p!==0)text=text.replace(/\b[xt]\b/g,'('+Number(n.k.toPrecision(4))+'*x'+(n.p<0?'':'+')+Number(n.p.toPrecision(4))+')');if(n.a!==1)text=Number(n.a.toPrecision(4))+' · '+text;if(n.b!==0)text+=' + ('+n.b+')';if(n.unary!=='none')text=n.unary+'('+text+')';if(state.mode==='parametric')text=text.replace(/\bx\b/g,'t');return text;}return nodeTitle(n);}
  function dropTarget(el,id,channel){el.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('application/x-equation-painter')){e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='copy';el.style.outline='2px dashed #009b9c';}});el.addEventListener('dragleave',()=>el.style.outline='');el.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();el.style.outline='';const index=e.dataTransfer.getData('application/x-equation-painter');if(index!=='')add(palette.node(Number(index)),id,channel);});}
  function expressionNode(n,depth=0,channel=state.active){const el=document.createElement('span');el.className='expression-node'+(channel===state.active&&n.id===state.selected?' selected':'');el.tabIndex=0;el.setAttribute('role','button');el.setAttribute('aria-label','Select '+nodeTitle(n));el.title='Select this part; drop here to combine with it';el.addEventListener('click',e=>{e.stopPropagation();select(n.id,channel);});el.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target===el){e.preventDefault();e.stopPropagation();select(n.id,channel);}});dropTarget(el,n.id,channel);
    if(n.type==='leaf'){const label=document.createElement('span');label.className='node-label';label.textContent=short(n);el.append(label);}
    
    else{const symbol=document.createElement('span');symbol.className='operation-symbol';symbol.textContent=operations.find(o=>o[0]===n.op)[1];const transformed=n.a!==1||n.b!==0||n.k!==1||n.p!==0||n.unary!=='none';if(transformed){const t=document.createElement('span');t.className='group-caption';t.textContent='Transformed';el.append(t);}el.append('(',expressionNode(n.left,depth+1,channel),symbol,expressionNode(n.right,depth+1,channel),')');}return el;
  }
  const parameterSpecs=[['a','Amplitude','a',.1],['b','Constant','b',.1],['k','Frequency','k',.1],['p','Phase','φ',.1]];
  parameterSpecs.forEach(([key,label,symbol,step])=>{const row=document.createElement('label');row.className='parameter';const text=document.createElement('span');text.innerHTML=label+' <small>'+symbol+'</small>';const input=document.createElement('input');input.type='number';input.step=step;input.id='param-'+key;input.setAttribute('aria-label',label);let editing=false;input.onfocus=()=>editing=false;input.oninput=()=>{const n=selected();if(!n||!Number.isFinite(input.valueAsNumber))return;if(!editing){checkpoint();editing=true;}n[key]=input.valueAsNumber;plot.draw();renderExpressions();renderPreview();$('undo').disabled=false;$('redo').disabled=true;notify(label+' updated');};input.onblur=()=>{editing=false;const n=selected();if(n)input.value=n[key];};row.append(text,input);$('parameter-fields').append(row);});
  function renderExpressions(){
    for(const channel of ['f','g']){
      const target=$('expression-'+channel);target.replaceChildren();
      if(state.functions[channel])target.append(expressionNode(state.functions[channel],0,channel));
      else{const empty=document.createElement('span');empty.className='expression-placeholder';empty.textContent='Drop a function to begin';target.append(empty);}
    }
  }
  function renderPreview(){
    const parametric=state.mode==='parametric';
    $('coordinate-preview-panel').hidden=!parametric;
    if(!parametric)return;
    $('coordinate-preview-title').textContent=(state.active==='f'?'Y coordinate · f(t)':'X coordinate · g(t)');
    EP.Plot.thumbnail($('coordinate-preview'),t=>M.evaluate(state.root,t),state.active==='f'?'#009b9c':'#8a79bd',state.range);
  }
  function render(){
    const parametric=state.mode==='parametric',active=state.active.toUpperCase();
    $('undo').disabled=!state.past.length;$('redo').disabled=!state.future.length;$('reset').disabled=!state.root;
    $('reset').textContent='Reset '+active;$('reset').title=state.active==='g'?'Restore g to the identity function':'Clear F only; G is preserved';
    $('show-code').disabled=false;
    $('empty').hidden=parametric?!!state.functions.f:state.active==='g'||!!state.functions.f;
    $('empty-title').textContent=parametric?'Give your drawing a Y coordinate.':'A blank canvas. Infinite possibilities.';
    $('empty-description').textContent=parametric?'Select F and add a function, or try the Circle preset.':'Drag a function here, or click one to begin. Try Fourier Studio for an instant series.';
    for(const channel of ['f','g']){
      $('editor-'+channel).classList.toggle('active',state.active===channel);
      $('select-'+channel).setAttribute('aria-pressed',state.active===channel);
      $('label-'+channel).textContent=channel+'('+(parametric?'t':'x')+')';
    }
    $('role-f').textContent=parametric?'Y coordinate':'Output function';
    $('role-g').textContent=parametric?'X coordinate':'Input mapping';
    $('mode-modulation').setAttribute('aria-pressed',!parametric);$('mode-parametric').setAttribute('aria-pressed',parametric);
    $('plot-formula').textContent=parametric?'(x, y) = (g(t), f(t))':'y = f(g(x))';
    $('plot-label').textContent=parametric?'Drawing (g(t), f(t)) · editing '+active:state.active==='g'?'Showing g(x) · input mapping':'Showing y = f(g(x))';
    $('result-legend').textContent=parametric?'(g(t), f(t))':state.active==='g'?'Input g(x)':'Result f(g(x))';
    document.querySelector('.legend-component').hidden=parametric;
    $('components').disabled=parametric;$('components').parentElement.hidden=parametric;
    $('parameter-range').hidden=!parametric;$('t-start').value=state.range.start;$('t-end').value=state.range.end;
    $('expression-hint').textContent='Editing '+active+' · Drops and Fourier series use '+active+'. Select a part to adjust it.';
    $('parts-title').textContent=active+' · Expression parts';$('drop-target').textContent=active;
    renderExpressions();
    const n=selected();$('parameters').disabled=!n;$('selection-type').textContent=n?(n.type==='leaf'?'FUNCTION':'GROUP'):'No selection';$('selection-name').textContent=n?nodeTitle(n):'Select a function to shape it.';
    parameterSpecs.forEach(([key])=>$('param-'+key).value=n?n[key]:'');$('unary').value=n?.unary||'none';$('blend-label').hidden=n?.op!=='blend';if(n?.op==='blend'){$('blend').value=n.t;$('blend-value').textContent=n.t;}
    const parts=$('parts');parts.replaceChildren();let count=0;M.walk(state.root,(node,depth)=>{if(node.type==='leaf')count++;const b=document.createElement('button');b.className='part-row'+(node.id===state.selected?' selected':'');b.style.paddingLeft=(8+Math.min(depth,5)*9)+'px';const dot=document.createElement('span');dot.className='part-dot';dot.style.background=node.type==='leaf'?node.color:'#b7c7cb';const text=document.createElement('span');text.textContent=nodeTitle(node);b.append(dot,text);b.title=node.type==='leaf'?short(node):nodeTitle(node);b.onclick=()=>select(node.id);dropTarget(b,node.id);parts.append(b);});if(!state.root){const p=document.createElement('p');p.className='subtext';p.textContent='Your functions will appear here.';parts.append(p);}$('part-count').textContent=count;
    plot.document=state;plot.root=state.root;plot.selected=n;plot.components=$('components').checked;plot.draw();renderPreview();if($('code-dialog').open)$('code').value=state.code();
  }
  $('undo').onclick=undo;$('redo').onclick=redo;
  $('reset').onclick=()=>{state.reset();render();notify(state.active==='g'?'G restored to identity · F preserved':'F cleared · G preserved');};
  $('remove').onclick=()=>{state.remove();render();notify('Part removed'+(state.active==='g'?' · Empty G returns to identity':''));};
  for(const channel of ['f','g']){
    $('select-'+channel).onclick=()=>{state.active=channel;render();notify('Editing '+channel.toUpperCase());};
    dropTarget($('editor-'+channel),null,channel);
  }
  for(const mode of ['modulation','parametric'])$('mode-'+mode).onclick=()=>{state.setMode(mode);render();plot.fit();notify(mode==='parametric'?'Parametric drawing · equal X/Y scale':'Input modulation · F and G preserved');};
  $('circle-preset').onclick=()=>{state.circle();render();plot.fit();notify('Circle: x = cos(t), y = sin(t) · Undo restores both functions');};
  $('apply-range').onclick=()=>{
    if(!state.setRange($('t-start').valueAsNumber,$('t-end').valueAsNumber)){notify('Use finite t limits, with the end greater than the start.');$('t-end').setCustomValidity('End must be finite and greater than start.');$('t-end').reportValidity();return;}
    $('t-end').setCustomValidity('');render();plot.fit();notify('Parameter interval updated');
  };
  for(const id of ['t-start','t-end'])$(id).oninput=()=>$('t-end').setCustomValidity('');
  $('save-function').onclick=()=>{const n=selected();if(n){palette.add({name:nodeTitle(n)+' (saved)',tree:M.clone(n)});notify('Saved to palette');}};
  $('unary').onchange=e=>{const n=selected();if(n){checkpoint();n.unary=e.target.value;render();}};
  let blendStart=null;$('blend').addEventListener('input',e=>{const n=selected();if(!n)return;if(blendStart===null)blendStart=snapshot();n.t=Number(e.target.value);$('blend-value').textContent=n.t;plot.draw();renderExpressions();renderPreview();});$('blend').addEventListener('change',()=>{if(blendStart!==null){state.past.push(blendStart);state.future=[];blendStart=null;render();}});
  $('components').onchange=()=>{plot.components=$('components').checked;plot.draw();};
  document.querySelectorAll('[data-wave]').forEach(b=>b.onclick=()=>{state.wave=b.dataset.wave;document.querySelectorAll('[data-wave]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',x===b);});});
  $('harmonics').oninput=()=>$('harmonics-value').textContent=$('harmonics').value;
  $('generate').onclick=()=>{const a=$('fourier-amplitude').valueAsNumber,p=$('fourier-period').valueAsNumber;if(!Number.isFinite(a)||!Number.isFinite(p)||p<=0){notify('Enter a finite amplitude and a positive period.');return;}add(M.fourier(state.wave,Number($('harmonics').value),a,p));plot.fit();notify('Created '+$('harmonics').value+' '+state.wave+' harmonics in '+state.active.toUpperCase());};
  $('zoom-in').onclick=()=>plot.zoom(1.25);$('zoom-out').onclick=()=>plot.zoom(.8);$('home-view').onclick=()=>plot.fit();
  const workspace=$('workspace');workspace.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('application/x-equation-painter')){e.preventDefault();workspace.classList.add('drag-over');e.dataTransfer.dropEffect='copy';}});workspace.addEventListener('dragleave',e=>{if(!workspace.contains(e.relatedTarget))workspace.classList.remove('drag-over');});workspace.addEventListener('drop',e=>{e.preventDefault();workspace.classList.remove('drag-over');if(e.target.closest('#palette'))return;const value=e.dataTransfer.getData('application/x-equation-painter');if(value!=='')add(palette.node(Number(value)));});document.addEventListener('dragend',()=>workspace.classList.remove('drag-over'));
  $('add-function').onclick=()=>{$('function-dialog').showModal();$('function-source').focus();};
  function preview(){try{const f=EP.Math.compile($('function-source').value);EP.Plot.thumbnail($('function-preview'),f.eval,'#009b9c');$('function-error').textContent='';return true;}catch(e){$('function-error').textContent=e.message;return false;}}
  $('function-source').oninput=preview;$('function-form').onsubmit=e=>{e.preventDefault();if(!preview())return;palette.add({source:$('function-source').value.trim(),name:$('function-name').value.trim()||$('function-source').value.trim()});$('function-dialog').close();$('function-form').reset();notify('Custom function added to palette');};
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
  $('show-code').onclick=()=>{$('code').value=state.code();$('code-dialog').showModal();};
  $('copy-code').onclick=async()=>{try{await navigator.clipboard.writeText($('code').value);notify('JavaScript copied');$('copy-code').textContent='Copied';setTimeout(()=>$('copy-code').textContent='Copy JavaScript',1500);}catch{$('code').focus();$('code').select();notify('Press ⌘C or Ctrl+C to copy the selected code');}};
  document.addEventListener('keydown',e=>{if(e.target.matches('input,textarea,select'))return;if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}});

  // Small programmatic interface to the same live document and UI update path.
  // `paint` adds an expression, `select` chooses an editor/node, `set` changes
  // settings or the selected node, `do` runs discrete actions, and `get` reads state.
  EP.api={
    paint(expression,{to=state.active,op=state.operator,at=null,name}={}){
      let node;
      if(typeof expression==='string'){
        EP.Math.compile(expression);
        node=M.leaf(expression,name);
      }else if(expression&&typeof expression==='object'&&'wave'in expression){
        node=M.fourier(expression.wave,expression.terms??7,expression.amplitude??1,expression.period??2*Math.PI);
      }else if(expression&&typeof expression==='object'&&expression.type){node=M.clone(expression);}
      else throw new TypeError('paint expects a math expression, expression node, or Fourier options');
      const previous=state.operator;
      if(!['add','subtract','multiply','divide','inside','outside','power','blend','upper','lower','replace'].includes(op))throw new RangeError('Unknown operation: '+op);
      state.operator=op;
      try{add(node,at,to);}finally{state.operator=previous;}
      return this.get();
    },
    select(target,to=state.active){
      if(!['f','g'].includes(to))throw new RangeError('Editor must be f or g');
      const id=typeof target==='string'?target:target?.id;
      if(id&&!M.find(state.functions[to],id))throw new RangeError('No expression part '+id+' in '+to.toUpperCase());
      state.active=to;state.selected=id||state.functions[to]?.id||null;render();return this.get();
    },
    set(options={}){
      let changed=false,fit=false;
      if(options.to!==undefined){if(!['f','g'].includes(options.to))throw new RangeError('Editor must be f or g');state.active=options.to;changed=true;}
      if(options.operator!==undefined){if(!['add','subtract','multiply','divide','inside','outside','power','blend','upper','lower','replace'].includes(options.operator))throw new RangeError('Unknown operation: '+options.operator);state.operator=options.operator;changed=true;}
      if(options.mode!==undefined){state.setMode(options.mode);changed=true;fit=true;}
      if(options.range!==undefined){if(!state.setRange(Number(options.range.start),Number(options.range.end)))throw new RangeError('Range must have finite limits with end greater than start');changed=true;fit=true;}
      if(options.selected!==undefined){const id=typeof options.selected==='string'?options.selected:options.selected?.id;if(id&&!M.find(state.root,id))throw new RangeError('Selected part is not in the active editor');state.selected=id||null;changed=true;}
      if(options.edit!==undefined){const n=selected();if(!n)throw new Error('Select an expression part before editing it');const e=options.edit;const keys=['a','b','k','p','t'];if(Object.keys(e).some(k=>!keys.includes(k)&&k!=='unary'))throw new RangeError('Editable values: a, b, k, p, t, unary');for(const k of keys)if(e[k]!==undefined&&!Number.isFinite(Number(e[k])))throw new TypeError(k+' must be finite');if(e.unary!==undefined&&!['none','abs','neg','reciprocal'].includes(e.unary))throw new RangeError('Unknown transform: '+e.unary);checkpoint();for(const k of keys)if(e[k]!==undefined)n[k]=Number(e[k]);if(e.unary!==undefined)n.unary=e.unary;changed=true;}
      if(options.components!==undefined){plot.components=!!options.components;$('components').checked=plot.components;changed=true;}
      if(options.view!==undefined){const v=options.view;for(const k of ['x','y','sx','sy'])if(v[k]!==undefined){if(!Number.isFinite(Number(v[k]))||(k==='sx'||k==='sy')&&Number(v[k])<=0)throw new TypeError('View values must be finite and scales positive');plot.view[k]=Number(v[k]);}changed=true;}
      if(options.palette!==undefined){const p=options.palette;if(!Number.isFinite(p.x)||!Number.isFinite(p.y))throw new TypeError('Palette x and y must be finite');const el=$('palette');el.style.left=Math.max(0,Math.min($('workspace').clientWidth-el.offsetWidth,p.x))+'px';el.style.top=Math.max(0,Math.min($('workspace').clientHeight-el.offsetHeight,p.y))+'px';}
      if(changed)render();if(fit)plot.fit();return this.get();
    },
    do(action,value){
      switch(action){
        case 'undo':undo();break;case 'redo':redo();break;case 'reset':$('reset').click();break;case 'remove':$('remove').click();break;case 'circle':$('circle-preset').click();break;case 'fit':plot.fit();break;
        case 'zoom':plot.zoom(Number(value));break;
        case 'save':$('save-function').click();break;
        case 'show-code':$('show-code').click();break;
        case 'close-dialog':document.querySelectorAll('dialog[open]').forEach(d=>d.close());break;
        case 'copy-code':$('code').value=state.code();$('copy-code').click();break;
        case 'palette':{const item=typeof value==='string'?{source:value,name:value}:{...value};if(!item?.source&&!item?.tree)throw new TypeError('palette expects a math expression or palette item');if(item.source)EP.Math.compile(item.source);palette.add(item);break;}
        case 'fourier':return this.paint({wave:value?.wave||state.wave,terms:value?.terms??7,amplitude:value?.amplitude??1,period:value?.period??2*Math.PI},value||{});
        default:throw new RangeError('Unknown action: '+action);
      }
      return this.get();
    },
    get(){return {active:state.active,mode:state.mode,operator:state.operator,range:{...state.range},functions:structuredClone(state.functions),selected:state.selected,view:{...plot.view},components:plot.components,palette:palette.items.map(x=>({name:x.name,source:x.source})),code:state.code()};}
  };
  render();
})();
