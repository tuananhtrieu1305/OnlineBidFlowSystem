import client from '../../../api/axiosClient';
import { csrfHeaders } from '../../auth/api/sessionApi';
export type Auction = {
 id:string;productId:string;product:{id:string;name:string;imageUrl:string|null};auctionType:'NORMAL'|'BLIND';accessType:'PUBLIC'|'PRIVATE';
 status:'UPCOMING'|'RUNNING'|'SOLD'|'UNSOLD';startingPrice:string;minBidIncrement:string|null;maxParticipants:number|null;roomCode:string|null;
 startTime:string;endTime:string;participantCount:string;editable:boolean;editBlockedReason:string|null;version:string;serverNow:string;
};
export type Filters={q:string;status:string;auctionType:string;accessType:string};
export type AuctionPage={items:Auction[];page:number;totalPages:number;totalElements:string;serverNow:string};
export async function listAuctions(filters:Filters,page:number,signal?:AbortSignal){return(await client.get<AuctionPage>('/api/admin/auctions',{params:{...filters,page,size:20},signal})).data;}
export async function getAuction(id:string){return(await client.get<Auction>('/api/admin/auctions/'+id)).data;}
export async function saveAuction(body:object,id?:string,version?:string){return(await client.request<Auction>({url:'/api/admin/auctions'+(id?'/'+id:''),method:id?'PUT':'POST',data:body,headers:{...await csrfHeaders(),...(version?{'If-Match':version}:{})},timeout:15000})).data;}
