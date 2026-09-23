import {zipSync,strToU8} from 'fflate';
import fixture from './fixtures/workbook.json' with {type:'json'};
export function workbookFixture(){
 const escape=(v:unknown)=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 const files:Record<string,Uint8Array>={};
 files['xl/workbook.xml']=strToU8(`<workbook><sheets>${fixture.journals.map((j,i)=>`<sheet name="${escape(j.sheet)}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`);
 files['xl/_rels/workbook.xml.rels']=strToU8(`<Relationships>${fixture.journals.map((_,i)=>`<Relationship Id="rId${i+1}" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`);
 fixture.journals.forEach((j,i)=>{const cell=(ref:string,value:unknown)=>value===null?'':typeof value==='string'?`<c r="${ref}" t="inlineStr"><is><t>${escape(value)}</t></is></c>`:`<c r="${ref}"><v>${value}</v></c>`;
  files[`xl/worksheets/sheet${i+1}.xml`]=strToU8(`<worksheet><sheetData><row r="4">${cell('G4','Resultado($)')}</row><row r="5">${cell('B5',j.initialBalance)}${cell('G5',j.baselineBreakEven?0:null)}</row>${j.rows.map(r=>{const n=r.sequence+5;return `<row r="${n}">${[['C',r.symbol],['D',r.riskPercent],['E',r.rewardRisk],['F',r.duration],['G',r.pnl]].map(([column,value])=>cell(`${column}${n}`,value)).join('')}</row>`;}).join('')}</sheetData></worksheet>`);
 });return Buffer.from(zipSync(files));
}
