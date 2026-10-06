import { createRoot } from 'react-dom/client';
import { Board } from './components/board/Board';
import './components/board/board.css';

createRoot(document.getElementById('root')!).render(<Board />);
