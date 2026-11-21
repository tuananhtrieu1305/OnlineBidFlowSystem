import { Navigate, useParams } from 'react-router-dom';
export default function AdminBlindClues(){const {id}=useParams();return <Navigate to={'/admin/auctions/'+id} replace/>;}
