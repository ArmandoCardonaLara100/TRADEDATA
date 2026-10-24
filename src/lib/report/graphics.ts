import type {Analytics} from '@/lib/analytics/journal';
import {number} from '@/lib/format';

const c={blue:'#3677F5',green:'#0A8866',red:'#C34657',gray:'#9AA7BA',ink:'#182131',muted:'#66748C',grid:'#E6EBF3',surface:'#F8FAFD'};
type Chart={x:number;y:number;w:number;h:number;title:string};

function panel(doc:PDFKit.PDFDocument,box:Chart){
 doc.lineWidth(.8).roundedRect(box.x,box.y,box.w,box.h,9).fillAndStroke('#FFFFFF',c.grid);
 doc.fillColor(c.ink).font('Helvetica-Bold').fontSize(10).text(box.title,box.x+12,box.y+12,{width:box.w-24});
 return {x:box.x+38,y:box.y+39,w:box.w-51,h:box.h-64};
}
function empty(doc:PDFKit.PDFDocument,box:Chart,label:string){
 doc.fillColor(c.muted).font('Helvetica').fontSize(9).text(label,box.x+12,box.y+box.h/2,{width:box.w-24,align:'center'});
}
function axes(doc:PDFKit.PDFDocument,x:number,y:number,w:number,h:number,min:number,max:number,format:(n:number)=>string){
 for(let i=0;i<=3;i++){
  const yy=y+h-i*h/3,value=min+(max-min)*i;
  doc.moveTo(x,yy).lineTo(x+w,yy).lineWidth(.5).strokeColor(c.grid).stroke();
  doc.fillColor(c.muted).font('Helvetica').fontSize(7).text(format(value),x-34,yy-4,{width:30,align:'right'});
 }
}
function scale(values:number[]){const min=Math.min(...values),max=Math.max(...values);if(min===max){const pad=Math.max(Math.abs(min)*.1,1);return [min-pad,max+pad] as const;}const pad=(max-min)*.12;return [min-pad,max+pad] as const;}
function lineChart(doc:PDFKit.PDFDocument,box:Chart,values:number[],color:string,format:(n:number)=>string,emptyLabel:string){
 const plot=panel(doc,box);if(values.length<2){empty(doc,box,emptyLabel);return;}
 const [low,high]=scale(values),min=low,max=color===c.red&&values.every(v=>v<=0)?0:high;
 axes(doc,plot.x,plot.y,plot.w,plot.h,min,max,format);
 doc.save().rect(plot.x,plot.y,plot.w,plot.h).clip();
 values.forEach((v,i)=>{const px=plot.x+i*plot.w/(values.length-1),py=plot.y+plot.h-(v-min)/(max-min)*plot.h;if(i===0)doc.moveTo(px,py);else doc.lineTo(px,py);});
 doc.lineWidth(2).strokeColor(color).stroke();doc.restore();
 doc.fillColor(c.muted).font('Helvetica').fontSize(7).text(`1`,plot.x,plot.y+plot.h+5);
 doc.text(String(values.length-1),plot.x+plot.w-35,plot.y+plot.h+5,{width:35,align:'right'});
}
function bars(doc:PDFKit.PDFDocument,box:Chart,items:{label:string;value:number}[],format:(n:number)=>string,emptyLabel:string){
 const plot=panel(doc,box);if(!items.length){empty(doc,box,emptyLabel);return;}
 const values=items.map(x=>x.value),[min,max]=scale([...values,0]);axes(doc,plot.x,plot.y,plot.w,plot.h,min,max,format);
 const zero=plot.y+plot.h-(0-min)/(max-min)*plot.h,step=plot.w/items.length,width=Math.max(2,Math.min(22,step*.68));
 doc.save().rect(plot.x,plot.y,plot.w,plot.h).clip();
 items.forEach((item,i)=>{const top=plot.y+plot.h-(item.value-min)/(max-min)*plot.h;doc.rect(plot.x+i*step+(step-width)/2,Math.min(top,zero),width,Math.max(1,Math.abs(top-zero))).fill(item.value>=0?c.green:c.red);});
 doc.restore();
 const ticks=Math.min(items.length,5);for(let i=0;i<ticks;i++){const idx=Math.round(i*(items.length-1)/Math.max(1,ticks-1));doc.fillColor(c.muted).font('Helvetica').fontSize(7).text(items[idx].label,plot.x+idx*step-13,plot.y+plot.h+5,{width:Math.max(32,step),align:'center',ellipsis:true});}
}
function donut(doc:PDFKit.PDFDocument,box:Chart,a:Analytics,language:'en'|'es'){
 panel(doc,box);if(!a.total){empty(doc,box,language==='es'?'Sin operaciones cerradas':'No closed operations');return;}
 const cx=box.x+box.w*.5,cy=box.y+96,r=47,values=[a.wins,a.losses,a.breakEven],colors=[c.green,c.red,c.gray];
 for(let segment=0;segment<360;segment++){
  const angle=-Math.PI/2+2*Math.PI*segment/360,next=angle+2*Math.PI/360;
  const fraction=(segment+.5)/360;
  const color=fraction<a.wins/a.total?colors[0]:fraction<(a.wins+a.losses)/a.total?colors[1]:colors[2];
  doc.moveTo(cx+r*Math.cos(angle),cy+r*Math.sin(angle)).lineTo(cx+r*Math.cos(next),cy+r*Math.sin(next)).lineWidth(12).strokeColor(color).stroke();
 }
 doc.fillColor(c.ink).font('Helvetica-Bold').fontSize(18).text(String(a.total),cx-35,cy-13,{width:70,align:'center'});
 const names=language==='es'?['Ganadoras','Perdedoras','Neutras']:['Wins','Losses','Break-even'];
 values.forEach((value,i)=>{const y=box.y+150+i*17;doc.circle(box.x+17,y+4,3).fill(colors[i]);doc.fillColor(c.muted).font('Helvetica').fontSize(8).text(names[i],box.x+27,y,{width:box.w-70});doc.fillColor(c.ink).font('Helvetica-Bold').text(String(value),box.x+box.w-39,y,{width:25,align:'right'});});
}
function symbols(doc:PDFKit.PDFDocument,box:Chart,a:Analytics,language:'en'|'es'){
 const plot=panel(doc,box),items=a.bySymbol.slice(0,8);if(!items.length){empty(doc,box,language==='es'?'Sin instrumentos':'No instruments');return;}
 const max=Math.max(1,...items.map(x=>x.count)),step=plot.w/items.length,bw=Math.min(23,step*.68);
 axes(doc,plot.x,plot.y,plot.w,plot.h,0,max,x=>number(x,0));
 items.forEach((item,i)=>{let bottom=plot.y+plot.h;[item.win,item.loss,item.breakeven].forEach((value,j)=>{if(!value)return;const h=value/max*plot.h;doc.rect(plot.x+i*step+(step-bw)/2,bottom-h,bw,h).fill([c.green,c.red,c.gray][j]);bottom-=h;});doc.fillColor(c.muted).font('Helvetica').fontSize(6.5).text(item.symbol,plot.x+i*step-6,plot.y+plot.h+5,{width:step+12,align:'center',ellipsis:true});});
}
export function overviewGraphics(doc:PDFKit.PDFDocument,a:Analytics,language:'en'|'es'){
 const cash=(n:number)=>new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(n);
 lineChart(doc,{x:42,y:415,w:325,h:198,title:language==='es'?'Saldo de la cuenta':'Account balance'},a.equity.map(x=>x.balance),c.blue,cash,language==='es'?'Registra una operación para ver la curva':'Record an operation to see the curve');
 donut(doc,{x:378,y:415,w:175,h:198,title:language==='es'?'Resultados':'Trade outcomes'},a,language);
 lineChart(doc,{x:42,y:626,w:511,h:126,title:language==='es'?'Debajo del máximo':'Below the high-water mark'},a.equity.map(x=>x.drawdown),c.red,n=>`${number(n,1)}%`,language==='es'?'Sin drawdown registrado':'No drawdown recorded');
}
export function statisticsGraphics(doc:PDFKit.PDFDocument,a:Analytics,language:'en'|'es'){
 const cash=(n:number)=>new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(n);
 const na=language==='es'?'Sin datos disponibles':'No data available';
 bars(doc,{x:42,y:330,w:249,h:193,title:language==='es'?'Resultados por operación':'Results by operation'},a.equity.slice(1).slice(-40).map(x=>({label:x.label,value:x.pnl})),cash,na);
 symbols(doc,{x:304,y:330,w:249,h:193,title:language==='es'?'Rendimiento por instrumento':'Performance by instrument'},a,language);
 lineChart(doc,{x:42,y:537,w:249,h:193,title:language==='es'?'Drawdown':'Drawdown'},a.equity.map(x=>x.drawdown),c.red,n=>`${number(n,1)}%`,na);
 bars(doc,{x:304,y:537,w:249,h:193,title:language==='es'?'Ganancia y pérdida mensual':'Monthly profit & loss'},a.monthly.slice(-12).map(x=>({label:x.month.slice(5),value:x.net})),cash,na);
 doc.fillColor(c.muted).font('Helvetica').fontSize(8).text(language==='es'?'Los gráficos muestran hasta 40 resultados recientes, 8 instrumentos y 12 meses. Los indicadores usan el historial completo.':'Charts show up to 40 recent results, 8 instruments and 12 months. Metrics use the full history.',42,741,{width:511});
}
