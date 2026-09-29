import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AppProviders } from '../../../src/app/AppProviders';
import '../../../src/styles/global.css';
import { pulseRouter } from './pulseRouter';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppProviders>
      <RouterProvider router={pulseRouter} />
    </AppProviders>
  </React.StrictMode>
);
