import client from '../../../api/axiosClient';
import type { Wallet, History } from '../../wallet/walletApi';
export type UserSummary={id:string;username:string;role:'USER'|'ADMIN'};
export type UserDetail=UserSummary&{walletState:'AVAILABLE'|'MISSING'|'NOT_APPLICABLE';wallet:Wallet|null};
export type UserPage={items:UserSummary[];page:number;totalPages:number;totalElements:string};
export async function listUsers(q:string,role:string,page:number,signal:AbortSignal){return(await client.get<UserPage>('/api/admin/users',{params:{q,role,page,size:20},signal})).data;}
export async function getUser(id:string,signal:AbortSignal){return(await client.get<UserDetail>('/api/admin/users/'+id,{signal})).data;}
export async function getUserHistory(id:string,type:string,cursor:string|null,signal:AbortSignal){return(await client.get<History>('/api/admin/users/'+id+'/transactions',{params:{type:type||undefined,cursor:cursor||undefined,limit:20},signal})).data;}
