export class ApiError extends Error {constructor(message:string,public status:number,public code?:string){super(message);this.name='ApiError';}}
export async function api<T>(path:string,options:RequestInit={}):Promise<T>{
 const response=await fetch(path,{...options,headers:{...(options.body instanceof FormData?{}:{'Content-Type':'application/json'}),...options.headers}});
 const result=await response.json();if(!response.ok)throw new ApiError(result.error||'The request failed. Try again.',response.status,result.code);return result;
}
export const message=(error:unknown)=>error instanceof Error?error.message:'Something went wrong. Try again.';
