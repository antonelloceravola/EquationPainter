'use strict';
EP.Plot = class {
  constructor(canvas,onCoordinates){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.view={x:0,y:0,sx:65,sy:110};this.root=null;this.selected=null;this.components=true;this.onCoordinates=onCoordinates;
    new ResizeObserver(()=>this.draw()).observe(canvas);
    canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();this.zoom(Math.exp(-e.deltaY*.001),e.clientX-r.left,e.clientY-r.top);},{passive:false});
    canvas.addEventListener('pointerdown',e=>{this.pan={px:e.clientX,py:e.clientY,x:this.view.x,y:this.view.y};canvas.setPointerCapture(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;if(this.pan){this.view.x=this.pan.x-(e.clientX-this.pan.px)/this.view.sx;this.view.y=this.pan.y+(e.clientY-this.pan.py)/this.view.sy;this.draw();}this.onCoordinates?.((px-this.w/2)/this.view.sx+this.view.x,(this.h/2-py)/this.view.sy+this.view.y);});
    canvas.addEventListener('pointerup',()=>this.pan=null);canvas.addEventListener('pointercancel',()=>this.pan=null);
  }
  zoom(f,px=this.w/2,py=this.h/2){const v=this.view,wx=(px-this.w/2)/v.sx+v.x,wy=(this.h/2-py)/v.sy+v.y;v.sx=Math.max(8,Math.min(1800,v.sx*f));v.sy=Math.max(8,Math.min(1800,v.sy*f));v.x=wx-(px-this.w/2)/v.sx;v.y=wy-(this.h/2-py)/v.sy;this.draw();}
  fit(){
    if(this.document?.mode==='parametric'){
      const points=[];const {start,end}=this.document.range;
      for(let i=0;i<=1024;i++){const p=this.document.point(start+(end-start)*i/1024);if(Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<1e6&&Math.abs(p.y)<1e6)points.push(p);}
      let minX=-1,maxX=1,minY=-1,maxY=1;
      if(points.length){minX=Math.min(...points.map(p=>p.x));maxX=Math.max(...points.map(p=>p.x));minY=Math.min(...points.map(p=>p.y));maxY=Math.max(...points.map(p=>p.y));}
      const reserve=this.w>640?210:120;
      const scale=Math.max(.001,Math.min(1800,(this.w-reserve-40)/(Math.max(.5,maxX-minX)*1.3),(this.h-90)/(Math.max(.5,maxY-minY)*1.3)));
      this.view={x:(minX+maxX)/2-reserve/2/scale,y:(minY+maxY)/2,sx:scale,sy:scale};
    }else this.view={x:0,y:0,sx:Math.max(25,(this.w-200)/(4*Math.PI)),sy:Math.max(25,this.h/5)};
    this.draw();
  }
  draw(){
    const c=this.canvas,ctx=this.ctx,dpr=window.devicePixelRatio||1;this.w=c.clientWidth;this.h=c.clientHeight;if(!this.w||!this.h)return;
    c.width=Math.round(this.w*dpr);c.height=Math.round(this.h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,this.w,this.h);
    const v=this.view,ox=this.w/2-v.x*v.sx,oy=this.h/2+v.y*v.sy;
    const step=scale=>{const raw=65/scale,base=10**Math.floor(Math.log10(raw));return [1,2,5,10].find(x=>x*base>=raw)*base;};
    const dx=step(v.sx),dy=step(v.sy);
    const lines=(unit,scale,origin,length,vertical,major)=>{const gap=unit*scale;ctx.beginPath();for(let p=((origin%gap)+gap)%gap;p<length;p+=gap){if(vertical){ctx.moveTo(p,0);ctx.lineTo(p,this.h);}else{ctx.moveTo(0,p);ctx.lineTo(this.w,p);}}ctx.strokeStyle=major?'#e5edef':'#f2f6f7';ctx.lineWidth=1;ctx.stroke();};
    lines(dx/5,v.sx,ox,this.w,true,false);lines(dy/5,v.sy,oy,this.h,false,false);lines(dx,v.sx,ox,this.w,true,true);lines(dy,v.sy,oy,this.h,false,true);
    ctx.beginPath();ctx.moveTo(ox,0);ctx.lineTo(ox,this.h);ctx.moveTo(0,oy);ctx.lineTo(this.w,oy);ctx.strokeStyle='#98aab2';ctx.stroke();ctx.fillStyle='#82929a';ctx.font='10px -apple-system, sans-serif';
    const fmt=n=>Math.abs(n)<1e-8?'0':Number(n.toPrecision(4)).toString();
    for(let x=Math.ceil((v.x-this.w/2/v.sx)/dx)*dx;x<v.x+this.w/2/v.sx;x+=dx){const px=this.w/2+(x-v.x)*v.sx;ctx.fillText(fmt(x),px+4,Math.max(14,Math.min(this.h-8,oy+16)));}
    for(let y=Math.ceil((v.y-this.h/2/v.sy)/dy)*dy;y<v.y+this.h/2/v.sy;y+=dy){if(Math.abs(y)>1e-8)ctx.fillText(fmt(y),Math.max(7,Math.min(this.w-30,ox+7)),this.h/2-(y-v.y)*v.sy-5);}
    ctx.font='italic 14px Georgia';ctx.fillText('x',this.w-16,Math.max(16,Math.min(this.h-12,oy-8)));ctx.fillText('y',Math.max(10,Math.min(this.w-16,ox+10)),17);
    if(this.document?.mode==='parametric'){
      if(this.document.functions.f)this.parametric();
    }else if(this.root){
      const mapping=this.document?.active==='f'?x=>EP.Model.evaluate(this.document.functions.g,x):x=>x;
      const color=this.document?.active==='g'?'#8a79bd':'#009b9c';
      if(this.components)EP.Model.walk(this.root,n=>{if(n.type==='leaf'&&n!==this.root)this.curve(x=>EP.Model.evaluate(n,mapping(x)),n.color,1,.23);});
      if(this.selected&&this.selected!==this.root)this.curve(x=>EP.Model.evaluate(this.selected,mapping(x)),'#df8a4b',2,.8);
      this.curve(x=>EP.Model.evaluate(this.root,mapping(x)),color,2.6,1);
    }
  }
  curve(fn,color,width,alpha){
    const ctx=this.ctx,v=this.view;ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.globalAlpha=alpha;let last=null;
    for(let px=0;px<=this.w;px+=.7){const x=(px-this.w/2)/v.sx+v.x,y=fn(x),py=this.h/2-(y-v.y)*v.sy;
      if(!Number.isFinite(py)||Math.abs(py)>this.h*5){last=null;continue;}
      let continuous=last&&Math.abs(py-last.py)<this.h*.65;
      if(continuous&&Math.abs(py-last.py)>15){const mid=fn((x+last.x)/2),expected=(y+last.y)/2;if(!Number.isFinite(mid)||Math.abs(mid-expected)*v.sy>8)continuous=false;}
      if(continuous)ctx.lineTo(px,py);else ctx.moveTo(px,py);last={x,y,py};
    }ctx.stroke();ctx.globalAlpha=1;
  }
  parametric(){
    const ctx=this.ctx,v=this.view,doc=this.document,{start,end}=doc.range;
    const screen=t=>{const p=doc.point(t);return {x:this.w/2+(p.x-v.x)*v.sx,y:this.h/2-(p.y-v.y)*v.sy};};
    const valid=p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<this.w*8&&Math.abs(p.y)<this.h*8;
    ctx.beginPath();ctx.strokeStyle='#009b9c';ctx.lineWidth=2.6;let last=null;
    const samples=4096;
    for(let i=0;i<=samples;i++){
      const t=start+(end-start)*i/samples,p=screen(t);
      if(!valid(p)){last=null;continue;}
      let continuous=last&&Math.hypot(p.x-last.p.x,p.y-last.p.y)<Math.max(this.w,this.h)*.5;
      if(continuous){const mid=screen((t+last.t)/2);if(!valid(mid)||Math.hypot(mid.x-(p.x+last.p.x)/2,mid.y-(p.y+last.p.y)/2)>6)continuous=false;}
      if(continuous)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);
      last={p,t};
    }
    ctx.stroke();
    const origin=screen(start);
    if(valid(origin)){ctx.beginPath();ctx.arc(origin.x,origin.y,4,0,2*Math.PI);ctx.fillStyle='#009b9c';ctx.fill();}
  }
  static thumbnail(canvas,fn,color,interval){const w=canvas.clientWidth||140,h=canvas.clientHeight||43,dpr=window.devicePixelRatio||1;canvas.width=w*dpr;canvas.height=h*dpr;const c=canvas.getContext('2d');c.scale(dpr,dpr);const values=Array.from({length:160},(_,i)=>fn(interval?interval.start+(interval.end-interval.start)*i/159:(i/159-.5)*Math.PI*4)),finite=values.filter(Number.isFinite).map(Math.abs).sort((a,b)=>a-b),range=Math.max(1,finite[Math.floor(finite.length*.92)]||1);c.strokeStyle='#edf1f3';c.beginPath();c.moveTo(0,h/2);c.lineTo(w,h/2);c.stroke();c.strokeStyle=color;c.lineWidth=1.6;c.beginPath();let last=null;values.forEach((v,i)=>{const y=h/2-v/range*h*.38,x=i/159*w;if(!Number.isFinite(y)||Math.abs(y)>h*2){last=null;return;}if(last!==null&&Math.abs(y-last)<h)c.lineTo(x,y);else c.moveTo(x,y);last=y;});c.stroke();}
};
