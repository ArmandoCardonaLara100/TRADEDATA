'use client';
import {useEffect,useRef,useState,type InputHTMLAttributes} from 'react';
import {numericInputNumber,numericInputValue} from '@/lib/numeric-input';

type Props=Omit<InputHTMLAttributes<HTMLInputElement>,'type'|'value'|'defaultValue'|'onChange'>&{
 value:number;
 scale?:number;
 onValueChange:(value:number)=>void;
};

/** Keeps an editable draft so typing `1.` or clearing the field never moves the cursor. */
export function NumericInput({value,scale=1,onValueChange,onBlur,onFocus,...props}:Props){
 const [draft,setDraft]=useState(()=>numericInputValue(value,scale));
 const editing=useRef(false),display=numericInputValue(value,scale);
 useEffect(()=>{if(!editing.current)setDraft(display);},[display]);
 return <input {...props} type="number" value={draft} onFocus={event=>{editing.current=true;onFocus?.(event);}} onChange={event=>{setDraft(event.target.value);onValueChange(numericInputNumber(event.target.value,scale));}} onBlur={event=>{editing.current=false;setDraft(numericInputValue(event.target.value));onBlur?.(event);}}/>;
}
