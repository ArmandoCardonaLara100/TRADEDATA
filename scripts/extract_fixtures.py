"""Extract numeric input/cached-result evidence without private journal notes."""
import json,pathlib,sys,openpyxl
wb=openpyxl.load_workbook(sys.argv[1],data_only=False)
cached=openpyxl.load_workbook(sys.argv[1],data_only=True)
fixtures={'journals':[],'monteCarlo':{}}
for name,end,threshold,summary in [('SEPTIEMBRE 2026',25,25,['S5','T5','U5','V5','W5','X5','O26','P26','Q26','O27','P27','Q27','O28','P28','Q28']),('AGOSTO-DICIEMBRE 2026',105,15,['Q5','R5','S5','T5','U5','V5','M106','N106','O106','M107','N107','O107','M108','N108','O108'])]:
 ws=wb[name]; cv=cached[name]; rows=[]
 for n in range(6,end+1):
  if not any(ws.cell(n,c).value is not None for c in range(3,8)): continue
  rows.append({'sequence':n-5,'symbol':ws[f'C{n}'].value,'riskPercent':ws[f'D{n}'].value,'rewardRisk':ws[f'E{n}'].value,'duration':ws[f'F{n}'].value if isinstance(ws[f'F{n}'].value,(int,float)) else None,'pnl':ws[f'G{n}'].value,'growth':cv[f'I{n}'].value,'drawdown':cv[f'J{n}'].value})
 fixtures['journals'].append({'sheet':name,'initialBalance':6000,'threshold':threshold,'baselineBreakEven':ws['G5'].value==0,'rows':rows,'expected':{cell:cv[cell].value for cell in summary}})
ws=cached['SIMULACION MONTE CARLO']
fixtures['monteCarlo']={'input':{'winProbability':ws['B4'].value,'rewardRisk':ws['B5'].value,'riskPercent':ws['B6'].value,'target':ws['B7'].value,'maxDrawdown':ws['B8'].value,'accounts':ws['B9'].value,'trades':ws['B11'].value,'trailing':False},'paths':[{'values':[ws.cell(r,c).value for r in range(26,127) if isinstance(ws.cell(r,c).value,(int,float))],'status':ws.cell(23,c).value} for c in range(4,104)],'expected':{cell:ws[cell].value for cell in ['F4','F5','F6','F15','F16','F17','F18','F19','F20']}}
out=pathlib.Path(__file__).resolve().parents[1]/'tests'/'fixtures';out.mkdir(parents=True,exist_ok=True)
(out/'workbook.json').write_text(json.dumps(fixtures,indent=2))
print('Extracted two journal datasets and 100 cached Monte Carlo paths.')
