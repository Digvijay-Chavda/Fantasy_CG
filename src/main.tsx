import { createRoot } from 'react-dom/client';
import { Battle } from './components/battle-ui/Battle';
import './components/battle-ui/battle.css';

createRoot(document.getElementById('root')!).render(<Battle />);
