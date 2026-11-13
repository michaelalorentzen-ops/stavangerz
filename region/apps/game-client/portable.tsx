import { createRoot } from 'react-dom/client';
import Game from './app/game';
import './app/game.css';

const root = document.getElementById('root');
if (!root) throw new Error('Spillets hovedvindu mangler.');
createRoot(root).render(<Game />);
