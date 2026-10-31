import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { HotelProvider } from './store/HotelContext';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HotelProvider>
      <App />
    </HotelProvider>
  </StrictMode>
);
