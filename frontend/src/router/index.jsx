import { createBrowserRouter } from 'react-router-dom';
import HomePage from '../pages/HomePage';
import AboutPage from '../pages/AboutPage';
import RoutingTestPage from '../pages/RoutingTestPage';
import ApiTestPage from '../pages/ApiTestPage';
import NotFoundPage from '../pages/NotFoundPage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />
  },
  {
    path: '/about',
    element: <AboutPage />
  },
  {
    path: '/routing-test',
    element: <RoutingTestPage />
  },
  {
    path: '/api-test',
    element: <ApiTestPage />
  },
  {
    path: '*',
    element: <NotFoundPage />
  }
]);

export default router;
