import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import router from './router';
import './index.css';
import { AuthProvider } from './features/auth/AuthProvider';
import './gallery-theme.css';
import './features/livestream/immersive-room.css';
import './features/livestream/auditorium.css';

const root = document.getElementById('root');
if (!root) throw new Error('Application root element is missing.');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <AuthProvider><RouterProvider router={router} /></AuthProvider>
  </React.StrictMode>
);
