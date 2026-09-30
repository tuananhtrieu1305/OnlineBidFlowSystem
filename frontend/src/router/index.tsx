import { createHashRouter } from 'react-router-dom';
import HomePage from '../pages/HomePage';
import NotFoundPage from '../pages/NotFoundPage';
import AppLayout from '../AppLayout';
import RegisterPage from '../features/auth/pages/RegisterPage';

export default createHashRouter([
  { path: '/register', element: <RegisterPage /> },
  { element: <AppLayout />, children: [
    { path: '/', element: <HomePage /> },
    { path: '*', element: <NotFoundPage /> }
  ] }
]);
