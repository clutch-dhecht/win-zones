import React, { useState, useEffect } from 'react';
import '@/App.css';
import axios from 'axios';
import MapDashboard from './components/MapDashboard';
import { Toaster } from '@/components/ui/sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  return (
    <div className="App">
      <MapDashboard apiUrl={API} />
      <Toaster />
    </div>
  );
}

export default App;
