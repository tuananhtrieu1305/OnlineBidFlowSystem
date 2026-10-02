import client from '../../../api/axiosClient';
import type {History} from '../../wallet/walletApi';
import {queryFilters,type Filters} from './filters';
export type Summary={walletId:string;availableBalance:string;lockedBalance:string;totalReceivedCoin:string;updatedAt:string;readAt:string};
export async function summary(signal:AbortSignal){return(await client.get<Summary>('/api/admin/system-wallet',{signal})).data;}
export async function history(filters:Filters,cursor:string|null,signal:AbortSignal){return(await client.get<History>('/api/admin/system-wallet/transactions',{params:{...queryFilters(filters),cursor:cursor??undefined,limit:20},signal})).data;}
