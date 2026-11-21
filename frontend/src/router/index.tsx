import { createHashRouter } from 'react-router-dom';
import HomePage from '../pages/HomePage';
import NotFoundPage from '../pages/NotFoundPage';
import AppLayout from '../AppLayout';
import RegisterPage from '../features/auth/pages/RegisterPage';
import LoginPage from '../features/auth/pages/LoginPage';
import AdminPage from '../pages/AdminPage';
import WalletPage from '../features/wallet/WalletPage';
import ProductsPage from '../features/products/ProductsPage';
import AdminAuctionsPage from '../features/auctions/configuration/AdminAuctionsPage';
import AdminUsersPage from '../features/admin/users/AdminUsersPage';
import SystemWalletPage from '../features/admin/system-wallet/SystemWalletPage';
import {DiscoveryDetail} from '../features/auctions/discovery/Discovery';
import { LivestreamDetailPage, LivestreamListPage, LivestreamPurchasesPage } from '../features/livestream/LivestreamPages';
import { HostLivestreamCreatePage, HostLivestreamListPage, HostLivestreamResultsPage } from '../features/livestream/HostLivestreamPages';
import LivestreamRoomPage from '../features/livestream/LivestreamRoomPage';

export default createHashRouter([
  { path: '/register', element: <RegisterPage /> },
  { path: '/login', element: <LoginPage /> },
  { element: <AppLayout />, children: [
    { path: '/', element: <HomePage /> },
    { path: '/livestream', element: <LivestreamListPage /> },
    { path: '/livestream/registrations', element: <LivestreamListPage registered /> },
    { path: '/livestream/purchases', element: <LivestreamPurchasesPage /> },
    { path: '/livestream/:id', element: <LivestreamDetailPage /> },
    { path: '/livestream/:id/room', element: <LivestreamRoomPage /> },
    { path: '/auctions/:id', element: <DiscoveryDetail /> },
    { path: '/admin', element: <AdminPage /> },
    { path: '/admin/livestream', element: <HostLivestreamListPage /> },
    { path: '/admin/livestream/new', element: <HostLivestreamCreatePage /> },
    { path: '/admin/livestream/:id', element: <LivestreamRoomPage host /> },
    { path: '/admin/livestream/:id/results', element: <HostLivestreamResultsPage /> },
    { path: '/admin/system-wallet', element: <SystemWalletPage /> },
    { path: '/admin/users', element: <AdminUsersPage /> },
    { path: '/admin/users/:id', element: <AdminUsersPage /> },
    { path: '/admin/auctions', element: <AdminAuctionsPage /> },
    { path: '/admin/auctions/new', element: <AdminAuctionsPage /> },
    { path: '/admin/auctions/:id', element: <AdminAuctionsPage /> },
    { path: '/admin/auctions/:id/edit', element: <AdminAuctionsPage /> },
    { path: '/admin/products', element: <ProductsPage /> },
    { path: '/admin/products/new', element: <ProductsPage /> },
    { path: '/admin/products/:id', element: <ProductsPage /> },
    { path: '/admin/products/:id/edit', element: <ProductsPage /> },
    { path: '/wallet', element: <WalletPage /> },
    { path: '*', element: <NotFoundPage /> }
  ] }
]);
