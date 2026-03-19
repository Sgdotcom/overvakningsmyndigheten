import React from 'react';
import { createRoot } from 'react-dom/client';
import SurveillanceChart from './SurveillanceChart.jsx';
import DroneStatsCharts from './DroneStatsCharts.jsx';
import { bootInvisibleProfile } from './invisibleProfile/boot.js';
import '../style.css';

const rootEl = document.getElementById('poi-chart-root');
if (rootEl) {
  const root = createRoot(rootEl);
  root.render(<SurveillanceChart />);
}

const droneStatsEl = document.getElementById('drone-stats-charts');
if (droneStatsEl) {
  const droneRoot = createRoot(droneStatsEl);
  droneRoot.render(<DroneStatsCharts />);
}

bootInvisibleProfile();
