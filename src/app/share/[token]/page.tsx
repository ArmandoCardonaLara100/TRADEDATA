import type {Metadata} from 'next';

import {SharedTradePage} from '@/features/share/shared-trade-page';
import {getSharedTrade} from '@/lib/server/shared-trade';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Shared operation',description:'A read-only TRADEDATA operation shared by its owner.',robots:{index:false,follow:false,nocache:true}};

export default async function SharePage({params}:{params:Promise<{token:string}>}){
 const {token}=await params,shared=await getSharedTrade(token);
 return <SharedTradePage token={shared?token:''} trade={shared?.trade||null}/>;
}
