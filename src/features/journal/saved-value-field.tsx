'use client';

import {useId,useMemo,useRef,useState,type KeyboardEvent} from 'react';
import {BookmarkPlus,Check,ChevronDown,X} from 'lucide-react';
import {Button} from '@/components/ui';
import {useWorkspace} from '@/features/workspace/context';
import {api,message} from '@/lib/client';
import {useLanguage,type MessageKey} from '@/lib/i18n';

type SavedValue={id:string;name:string};
type Props={kind:'instrument'|'strategy';name:string;label:string;initialValue:string;placeholder:string;hint:string;items:SavedValue[];maxLength:number};

export function SavedValueField({kind,name,label,initialValue,placeholder,hint,items,maxLength}:Props){
 const {account,refresh,notify}=useWorkspace(),{t}=useLanguage();
 const inputId=useId(),listId=useId(),wrapper=useRef<HTMLDivElement>(null);
 const [value,setValue]=useState(initialValue),[open,setOpen]=useState(false),[active,setActive]=useState(0),[working,setWorking]=useState(false),[error,setError]=useState('');
 const normalized=value.trim(),saved=items.find(item=>item.name.localeCompare(normalized,undefined,{sensitivity:'accent'})===0);
 const filtered=useMemo(()=>items.filter(item=>item.name.toLocaleLowerCase().includes(normalized.toLocaleLowerCase())).slice(0,12),[items,normalized]);
 const endpoint=kind==='instrument'?'/api/instruments':'/api/strategies';
 const key=(suffix:string)=>`journal.${kind}${suffix}` as MessageKey;
 function choose(item:SavedValue){setValue(item.name);setOpen(false);setActive(0);}
 function keyDown(event:KeyboardEvent<HTMLInputElement>){
  if(event.key==='ArrowDown'){event.preventDefault();setOpen(true);setActive(index=>Math.min(Math.max(0,filtered.length-1),index+1));}
  else if(event.key==='ArrowUp'){event.preventDefault();setOpen(true);setActive(index=>Math.max(0,index-1));}
  else if(event.key==='Escape')setOpen(false);
  else if(event.key==='Enter'&&open&&filtered[active]){event.preventDefault();choose(filtered[active]);}
 }
 async function save(){if(!normalized||saved)return;setWorking(true);setError('');try{await api(endpoint,{method:'POST',body:JSON.stringify({name:normalized})});await refresh(account?.id);notify(t(key('Saved')));setOpen(false);}catch(cause){setError(message(cause));}finally{setWorking(false);}}
 async function remove(id:string){setWorking(true);setError('');try{await api(`${endpoint}?id=${encodeURIComponent(id)}`,{method:'DELETE'});await refresh(account?.id);notify(t(key('Removed')));}catch(cause){setError(message(cause));}finally{setWorking(false);}}
 return <div className="field saved-value-field" ref={wrapper} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setOpen(false);}}>
  <label htmlFor={inputId}>{label}</label>
  <div className="saved-value-entry"><div className="saved-value-combobox"><input id={inputId} name={name} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listId} aria-activedescendant={open&&filtered[active]?`${listId}-${filtered[active].id}`:undefined} autoComplete="off" placeholder={placeholder} maxLength={maxLength} value={value} onFocus={()=>setOpen(true)} onClick={()=>setOpen(true)} onChange={event=>{setValue(event.target.value);setOpen(true);setActive(0);}} onKeyDown={keyDown}/><ChevronDown size={15} aria-hidden="true"/></div><Button type="button" variant="ghost" disabled={working||!normalized||Boolean(saved)} onClick={()=>void save()}>{saved?<Check size={14}/>:<BookmarkPlus size={14}/>}<span>{t(saved?'journal.savedValue':key('Save'))}</span></Button></div>
  {open&&<div className="saved-value-menu" id={listId} role="listbox" aria-label={t(key('SavedValues'))}>{filtered.length?filtered.map((item,index)=><div id={`${listId}-${item.id}`} role="option" aria-selected={index===active} className={index===active?'active':''} key={item.id}><button type="button" className="saved-value-option" onMouseDown={event=>event.preventDefault()} onClick={()=>choose(item)}>{item.name}</button><button type="button" className="saved-value-remove" disabled={working} aria-label={t(key('Remove')).replace('{value}',item.name)} onMouseDown={event=>event.preventDefault()} onClick={()=>void remove(item.id)}><X size={13}/></button></div>):<p>{t('journal.noSavedSuggestions')}</p>}</div>}
  <small>{hint}</small>{error&&<small className="field-error" role="alert">{error}</small>}
 </div>;
}
