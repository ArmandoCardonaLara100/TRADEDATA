import 'server-only';

import {createHash,randomBytes} from 'node:crypto';

export const SHARE_TOKEN_PATTERN=/^[A-Za-z0-9_-]{43}$/;

export function hashShareToken(token:string){return createHash('sha256').update(token).digest('hex');}

export function createShareToken(){
 const token=randomBytes(32).toString('base64url');
 return {token,hash:hashShareToken(token)};
}
