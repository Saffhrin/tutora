import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';

// BASE_URL is "/" for local dev and "/tutora/" in the GitHub Pages build, so the
// router has to be mounted under it. Without the basename every route ("/library",
// "/tutor", ...) resolves to the domain root, outside the project site.
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter basename={import.meta.env.BASE_URL}><App /></BrowserRouter></React.StrictMode>);