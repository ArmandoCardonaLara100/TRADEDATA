'use client';
import {Expand,X} from 'lucide-react';
import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';

export function EvidenceImage({src,alt,openLabel,closeLabel}:{src:string;alt:string;openLabel:string;closeLabel:string}){
 const [open,setOpen]=useState(false),trigger=useRef<HTMLButtonElement>(null),closeButton=useRef<HTMLButtonElement>(null),titleId=useId(),descriptionId=useId();
 useEffect(()=>{
  if(!open)return;
  closeButton.current?.focus();
  const onKeyDown=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();setOpen(false);}
   if(event.key==='Tab'){event.preventDefault();closeButton.current?.focus();}
  };
  document.addEventListener('keydown',onKeyDown,true);
  return()=>{document.removeEventListener('keydown',onKeyDown,true);trigger.current?.focus();};
 },[open]);
 return <>
  <button ref={trigger} type="button" className="evidence-thumbnail" aria-label={openLabel} onClick={()=>setOpen(true)}>
   <img src={src} alt={alt}/><span className="evidence-thumbnail-action" aria-hidden="true"><Expand size={14}/></span>
  </button>
  {open&&createPortal(<div className="quicklook-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false);}}>
   <div className="quicklook-content" data-quicklook-content role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
    <h2 id={titleId} className="sr-only">{openLabel}</h2>
    <p id={descriptionId} className="sr-only">{alt}</p>
    <img src={src} alt={alt}/>
    <button ref={closeButton} type="button" className="quicklook-close" aria-label={closeLabel} onClick={()=>setOpen(false)}><X size={20}/></button>
   </div>
  </div>,document.body)}
 </>;
}
