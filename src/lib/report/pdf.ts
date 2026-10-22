import PDFDocument from 'pdfkit';
import {aggregateCalendarDays} from '@/lib/analytics/calendar';
import {calculateAnalytics,classify} from '@/lib/analytics/journal';
import {money,percent,number,signedMoney} from '@/lib/format';
import type {Trade,TradingAccount} from '@/types/trading';

const blue='#3677F5',ink='#182131',muted='#66748C',line='#DCE4F0',green='#0A8866',red='#C34657';
const labels={
 en:{overview:'Overview',journal:'Trading Journal',statistics:'Statistics',calendar:'Calendar',generated:'Generated',account:'Trading account',opening:'Opening balance',balance:'Current balance',net:'Net profit / loss',winRate:'Win rate',drawdown:'Maximum drawdown',riskReward:'Risk/Reward',total:'Closed operations',wins:'Wins',losses:'Losses',breakEven:'Break-even',grossProfit:'Gross profit',grossLoss:'Gross loss',profitFactor:'Profit factor',expectancy:'Expectancy per trade',avgWin:'Average winning trade',avgLoss:'Average losing trade',roi:'Return on starting capital',currentDrawdown:'Current drawdown',avgR:'Average R',date:'Trade date',number:'No.',instrument:'Instrument',result:'Net P/L',outcome:'Result',setup:'Setup / grade',noTrades:'No operations recorded for this account.',noDate:'Undated',open:'Open',noMonth:'No dated operations in this month.',note:'Days use the saved Trade Date. Green means positive net P/L; red means negative; neutral means zero.',page:'Page'},
 es:{overview:'Resumen',journal:'Diario de trading',statistics:'Estadísticas',calendar:'Calendario',generated:'Generado',account:'Cuenta de trading',opening:'Saldo inicial',balance:'Saldo actual',net:'Ganancia / pérdida neta',winRate:'Tasa de aciertos',drawdown:'Drawdown máximo',riskReward:'Riesgo/Beneficio',total:'Operaciones cerradas',wins:'Ganadoras',losses:'Perdedoras',breakEven:'Punto de equilibrio',grossProfit:'Ganancia bruta',grossLoss:'Pérdida bruta',profitFactor:'Factor de beneficio',expectancy:'Expectativa por operación',avgWin:'Ganancia media',avgLoss:'Pérdida media',roi:'Retorno sobre capital inicial',currentDrawdown:'Drawdown actual',avgR:'R promedio',date:'Fecha',number:'N.º',instrument:'Instrumento',result:'Resultado neto',outcome:'Estado',setup:'Setup / calificación',noTrades:'No hay operaciones registradas para esta cuenta.',noDate:'Sin fecha',open:'Abierta',noMonth:'No hay operaciones fechadas en este mes.',note:'Los días usan la fecha guardada de la operación. Verde indica resultado positivo; rojo, negativo; neutro, cero.',page:'Página'},
} as const;
export type ReportInput={account:TradingAccount;trades:Trade[];month:string;language:'en'|'es';generatedAt?:Date};

/** Server-side vector report. All metrics reuse the same analytics layer as the app. */
export async function generateReportPdf({account,trades,month,language,generatedAt=new Date()}:ReportInput):Promise<Buffer>{
 const t=labels[language],a=calculateAnalytics(trades,account),locale=language==='es'?'es-MX':'en-US';
 const doc=new PDFDocument({size:'A4',margin:42,bufferPages:true,info:{Title:`TRADEDATA — ${account.name}`,Author:'TRADEDATA',Subject:'Trading performance report'}});
 const chunks:Buffer[]=[];doc.on('data',(chunk:Buffer)=>chunks.push(chunk));
 const complete=new Promise<Buffer>((resolve,reject)=>{doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
 const width=doc.page.width-84;
 function header(title:string,index:string){
  doc.rect(0,0,doc.page.width,7).fill(blue);
  doc.fillColor(blue).font('Helvetica-Bold').fontSize(11).text('TRADEDATA',42,30);
  doc.fillColor(muted).font('Helvetica').fontSize(9).text(`${t.account}: ${account.name}`,42,49,{width});
  doc.fillColor(ink).font('Helvetica-Bold').fontSize(25).text(title,42,86);
  doc.fillColor(muted).font('Helvetica').fontSize(9).text(`${index} / 04  ·  ${t.generated}: ${new Intl.DateTimeFormat(locale,{dateStyle:'medium'}).format(generatedAt)}`,42,122);
  doc.moveTo(42,146).lineTo(doc.page.width-42,146).strokeColor(line).stroke();doc.y=165;
 }
 function section(title:string,index:string){doc.addPage();header(title,index);}
 function metric(label:string,value:string,x:number,y:number,w:number){
  doc.roundedRect(x,y,w,66,9).fill('#F5F8FC');doc.fillColor(muted).font('Helvetica').fontSize(9).text(label,x+12,y+12,{width:w-24});
  doc.fillColor(ink).font('Helvetica-Bold').fontSize(16).text(value,x+12,y+33,{width:w-24,ellipsis:true});
 }
 // 01 / Overview
 header(t.overview,'01');const col=(width-12)/2;
 metric(t.opening,money(Number(account.initialBalance),account.currency),42,175,col);
 metric(t.balance,money(a.balance,account.currency),54+col,175,col);
 metric(t.net,signedMoney(a.netProfit,account.currency),42,253,col);
 metric(t.winRate,percent(a.winRate*100,1),54+col,253,col);
 metric(t.drawdown,percent(a.maxDrawdown),42,331,col);
 metric(t.riskReward,a.riskReward===null?'—':`${number(a.riskReward,2,2)}R`,54+col,331,col);
 doc.fillColor(muted).font('Helvetica').fontSize(10).text(`${t.total}: ${a.total}  ·  ${t.open}: ${a.open}`,42,420);

 // 02 / Journal, with a repeated header on each overflow page.
 section(t.journal,'02');const columns=[42,78,143,228,302,377,553];
 function tableHeader(y:number){doc.rect(42,y,width,25).fill('#EDF2F9');[t.number,t.date,t.instrument,t.outcome,t.result,t.setup].forEach((label,i)=>doc.fillColor(ink).font('Helvetica-Bold').fontSize(8).text(label,columns[i]+5,y+8,{width:columns[i+1]-columns[i]-10,ellipsis:true}));return y+25;}
 let y=tableHeader(175);
 if(!trades.length)doc.fillColor(muted).font('Helvetica').fontSize(11).text(t.noTrades,48,y+18);
 for(const trade of [...trades].sort((x,z)=>(x.date||'').localeCompare(z.date||'')||x.sequence-z.sequence)){
  if(y+32>doc.page.height-85){doc.addPage();header(t.journal,'02');y=tableHeader(175);}
  const result=classify(trade.pnl,account.breakEvenBand);
  if(Math.floor(y/32)%2===0)doc.rect(42,y,width,31).fill('#FAFBFD');
  const values=[String(trade.sequence),trade.date||t.noDate,trade.symbol||'—',result==='open'?t.open:result==='win'?t.wins:result==='loss'?t.losses:t.breakEven,trade.pnl===null?'—':signedMoney(Number(trade.pnl),account.currency),[trade.strategy,trade.setupGrade].filter(Boolean).join(' / ')||'—'];
  values.forEach((value,i)=>doc.fillColor(i===4&&trade.pnl!==null?(Number(trade.pnl)<0?red:green):ink).font(i===4?'Helvetica-Bold':'Helvetica').fontSize(8).text(value,columns[i]+5,y+9,{width:columns[i+1]-columns[i]-10,ellipsis:true}));
  doc.moveTo(42,y+31).lineTo(doc.page.width-42,y+31).strokeColor(line).stroke();y+=32;
 }

 // 03 / Statistics, using exactly the analytics values shown in-app.
 section(t.statistics,'03');y=175;
 const rows:[string,string][]=[
  [t.total,String(a.total)],[t.wins,String(a.wins)],[t.losses,String(a.losses)],[t.breakEven,String(a.breakEven)],
  [t.winRate,percent(a.winRate*100,1)],[t.grossProfit,money(a.grossProfit,account.currency)],[t.grossLoss,money(a.grossLoss,account.currency)],
  [t.profitFactor,a.profitFactor===null?'—':number(a.profitFactor,2,2)],[t.expectancy,a.expectancy===null?'—':money(a.expectancy,account.currency)],
  [t.avgWin,a.averageWin===null?'—':money(a.averageWin,account.currency)],[t.avgLoss,a.averageLoss===null?'—':money(a.averageLoss,account.currency)],
  [t.roi,percent(a.roi)],[t.currentDrawdown,percent(a.currentDrawdown)],[t.avgR,a.averageR===null?'—':`${number(a.averageR,2,2)}R`],
 ];
 for(const [label,value] of rows){
  if(y>doc.page.height-90){doc.addPage();header(t.statistics,'03');y=175;}
  doc.fillColor(muted).font('Helvetica').fontSize(10).text(label,48,y,{width:width*.62});
  doc.fillColor(ink).font('Helvetica-Bold').fontSize(10).text(value,48+width*.62,y,{width:width*.38-6,align:'right'});
  doc.moveTo(48,y+21).lineTo(doc.page.width-48,y+21).strokeColor(line).stroke();y+=34;
 }

 // 04 / Calendar groups saved date-only strings; it never substitutes created_at.
 section(t.calendar,'04');
 const monthTitle=new Intl.DateTimeFormat(locale,{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${month}-01T12:00:00Z`));
 doc.fillColor(ink).font('Helvetica-Bold').fontSize(15).text(monthTitle,42,172);
 doc.fillColor(muted).font('Helvetica').fontSize(9).text(t.note,42,198,{width});
 const days=aggregateCalendarDays(trades.filter(trade=>trade.date?.startsWith(`${month}-`)));
 const [year,m]=month.split('-').map(Number),offset=new Date(Date.UTC(year,m-1,1)).getUTCDay(),count=new Date(Date.UTC(year,m,0)).getUTCDate();
 const weekDays=language==='es'?['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
 const gap=4,cellWidth=(width-6*gap)/7,top=248;
 weekDays.forEach((name,i)=>doc.fillColor(muted).font('Helvetica-Bold').fontSize(8).text(name,42+i*(cellWidth+gap),top,{width:cellWidth,align:'center'}));
 const countRows=Math.ceil((offset+count)/7),cellHeight=Math.min(74,(doc.page.height-335)/countRows);
 for(let day=1;day<=count;day++){
  const position=offset+day-1,row=Math.floor(position/7),colIndex=position%7,date=`${month}-${String(day).padStart(2,'0')}`,entry=days.get(date),x=42+colIndex*(cellWidth+gap),cellY=top+23+row*(cellHeight+gap);
  const tint=entry?.closed?(entry.state==='profit'?'#EAF7F1':entry.state==='loss'?'#FCEDEF':'#F3F5F8'):'#FFFFFF';
  doc.roundedRect(x,cellY,cellWidth,cellHeight,5).fillAndStroke(tint,line);
  doc.fillColor(ink).font('Helvetica-Bold').fontSize(9).text(String(day),x+7,cellY+7);
  if(entry?.closed)doc.fillColor(entry.state==='profit'?green:entry.state==='loss'?red:muted).font('Helvetica-Bold').fontSize(8).text(signedMoney(Number(entry.total),account.currency),x+5,cellY+cellHeight-20,{width:cellWidth-10,align:'center',ellipsis:true});
 }
 if(!days.size)doc.fillColor(muted).font('Helvetica').fontSize(10).text(t.noMonth,42,top+38+countRows*(cellHeight+gap));

 const pageRange=doc.bufferedPageRange();
 for(let i=pageRange.start;i<pageRange.start+pageRange.count;i++){doc.switchToPage(i);doc.moveTo(42,doc.page.height-61).lineTo(doc.page.width-42,doc.page.height-61).strokeColor(line).stroke();doc.fillColor(muted).font('Helvetica').fontSize(8).text(`TRADEDATA  ·  ${t.page} ${i+1} / ${pageRange.count}`,42,doc.page.height-52,{width,align:'right',lineBreak:false});}
 doc.end();return complete;
}
