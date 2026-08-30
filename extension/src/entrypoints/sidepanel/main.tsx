import React from 'react';
import ReactDOM from 'react-dom/client';
import ErrorBoundary from '../../ui/ErrorBoundary';
import '../../ui/styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <p className="notice">Side panel scaffold. Task 5 renders the reading panel here.</p>
    </ErrorBoundary>
  </React.StrictMode>,
);