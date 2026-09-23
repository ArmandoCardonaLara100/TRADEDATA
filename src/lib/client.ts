export async function api<T>(path:string,options:RequestInit={}):Promise<T>{
 const response=await fetch(path,{...options,headers:{...(options.body instanceof FormData?{}:{'Content-Type':'application/json'}),...options.headers}});
 const result=await response.json();if(!response.ok)throw new Error(result.error||'The request failed. Try again.');return result;
}
export const message=(error:unknown)=>error instanceof Error?error.message:'Something went wrong. Try again.';
