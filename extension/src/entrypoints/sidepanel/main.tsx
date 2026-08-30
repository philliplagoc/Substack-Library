import React from 'react';
import ReactDOM from 'react-dom/client';
import ErrorBoundary from '../../ui/ErrorBoundary';
import ReadingPanel from '../../ui/ReadingPanel';
import '../../ui/styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ReadingPanel />
    </ErrorBoundary>
  </React.StrictMode>,
);
