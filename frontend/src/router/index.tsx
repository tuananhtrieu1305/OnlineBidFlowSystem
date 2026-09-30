import { createHashRouter } from 'react-router-dom';
import HomePage from '../pages/HomePage';
import NotFoundPage from '../pages/NotFoundPage';
import AppLayout from '../AppLayout';
import RegisterPage from '../features/auth/pages/RegisterPage';
import LoginPage from '../features/auth/pages/LoginPage';
import AdminPage from '../pages/AdminPage';

export default createHashRouter([
  { path: '/register', element: <RegisterPage /> },
  { path: '/login', element: <LoginPage /> },
  { element: <AppLayout />, children: [
    { path: '/', element: <HomePage /> },
    { path: '/admin', element: <AdminPage /> },
    { path: '*', element: <NotFoundPage /> }
  ] }
]);
