import client from '../../../api/axiosClient';
import { csrfHeaders } from '../../auth/api/sessionApi';

export type Clue={id:string;slot:number;content:string;verified:boolean;acquiredAt:string};
export type Listing={id:string;clueId:string;sellerId:string;seller:string;price:string;version:string;slot:number};
export type BlindState={auctionId:string;phase:'WAITING'|'REVEAL'|'TRADE'|'DISCUSS'|'BID'|'LOCKED'|'SETTLING'|'FINISHED';status:string;serverNow:string;participantCount:number;onlineCount:number;
 product:{name:string;description:string|null;image_url:string|null};ownedClues:Clue[];listings:Listing[];
 ownBid:{id:string;amount:string;at:string}|null;historicalStats:{soldCount:number;averagePrice:string|null;minimumPrice:string|null;maximumPrice:string|null};
 lobbyClosesAt:string|null;revealEndsAt:string|null;tradeEndsAt:string|null;bidStartsAt:string|null;bidLocksAt:string|null;endsAt:string|null;
 result?:{status:string;winnerUserId:string|null;winningPrice:string|null;finishedAt:string|null};};
const path=(id:string)=>'/api/blind/auctions/'+encodeURIComponent(id);
export async function getBlindState(id:string){return(await client.get<BlindState>(path(id))).data;}
export async function listClue(id:string,clueId:string,price:string){return(await client.put(path(id)+'/listings/'+clueId,{price},{headers:await csrfHeaders()})).data;}
export async function cancelClue(id:string,clueId:string){return(await client.delete(path(id)+'/listings/'+clueId,{headers:await csrfHeaders()})).data;}
export async function buyClue(id:string,listingId:string,version:string){return(await client.post(path(id)+'/listings/'+listingId+'/buy',{version},{headers:await csrfHeaders()})).data;}
export async function submitBlindBid(id:string,amount:string){return(await client.post(path(id)+'/bids',{amount},{headers:await csrfHeaders()})).data;}
export async function getAdminClues(id:string){return(await client.get<{clues:string[]}>('/api/admin/blind/auctions/'+id+'/clues')).data;}
export async function saveAdminClues(id:string,clues:string[]){return(await client.put('/api/admin/blind/auctions/'+id+'/clues',{clues},{headers:await csrfHeaders()})).data;}
