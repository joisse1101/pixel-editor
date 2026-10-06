import { mountNav } from '../ui/nav';
import '../style.css';

const app = document.getElementById('app')!;
mountNav('pixel');
app.append(Object.assign(document.createElement('main'), { textContent: 'Pixel Art Editor' }));
