import { runMonteCarlo } from '../lib/simulation/monte-carlo';
import type { SimulationInput } from '../types/trading';
self.onmessage=(event:MessageEvent<SimulationInput>)=>{
 try {self.postMessage({type:'result',result:runMonteCarlo(event.data,progress=>self.postMessage({type:'progress',progress}))});}
 catch(error){self.postMessage({type:'error',message:error instanceof Error?error.message:'Simulation failed.'});}
};
