'use client';
import {createContext,useContext,useState,useRef,useCallback,type ReactNode} from 'react';
import type {getWorkspace} from '@/lib/server/repository';
import {api,message} from '@/lib/client';
import {useTheme} from 'next-themes';
import type {SimulationResult} from '@/types/trading';
export type WorkspaceData=Awaited<ReturnType<typeof getWorkspace>>;
type Context=WorkspaceData&{refresh:(id?:string|null)=>Promise<WorkspaceData>;select:(id:string)=>Promise<void>;deleteAccount:(id:string)=>Promise<void>;loading:boolean;error:string;notify:(text:string)=>void;notice:string;lastSimulation:SimulationResult|null;setLastSimulation:(result:SimulationResult)=>void};
const WorkspaceContext=createContext<Context|null>(null);
export function WorkspaceProvider({initial,children}:{initial:WorkspaceData;children:ReactNode}){
 const [data,setData]=useState(initial),[loading,setLoading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[lastSimulation,setLastSimulation]=useState<SimulationResult|null>(null);const request=useRef(0);const {theme}=useTheme();
 const selected=useRef(initial.account?.id);const refresh=useCallback(async(id?:string|null)=>{const sequence=++request.current,target=id===null?undefined:id||selected.current;setLoading(true);setError('');try{const next=await api<WorkspaceData>(`/api/workspace${target?`?accountId=${target}`:''}`);if(sequence===request.current){setData(next);selected.current=next.account?.id;}return next;}catch(e){if(sequence===request.current)setError(message(e));throw e;}finally{if(sequence===request.current)setLoading(false);}},[]);
 const select=async(id:string)=>{await refresh(id);try{await api('/api/preferences',{method:'PATCH',body:JSON.stringify({theme:theme||'system',accountId:id})});}catch(e){setError(message(e));}};
 const deleteAccount=async(id:string)=>{await api(`/api/accounts/${id}`,{method:'DELETE'});const next=await refresh(null);try{await api('/api/preferences',{method:'PATCH',body:JSON.stringify({theme:theme||'system',accountId:next.account?.id||null})});}catch(e){setError(message(e));}};
 return <WorkspaceContext.Provider value={{...data,refresh,select,deleteAccount,loading,error,notify:setNotice,notice,lastSimulation,setLastSimulation}}>{children}</WorkspaceContext.Provider>;
}
export function useWorkspace(){const value=useContext(WorkspaceContext);if(!value)throw new Error('Workspace provider is missing.');return value;}
