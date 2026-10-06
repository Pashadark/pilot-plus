import './style.css';
import './readability.css';
import './toasts.css';
import './reference-theme.css';
import './theme-dialog.css';
import './catalog-controls.css';
import './footer-polish.css';
import './redesign.css';
import ToastProvider from './toast-provider';
import StorageNotice from './storage-notice';
export const metadata={title:'TG CAR — аренда автомобилей в Москве',description:'Автомобиль для вашего ритма. Москва, Зелёный проспект, 22.'};
export default function Layout({children}) { return <html lang="ru" suppressHydrationWarning><head><script src="/theme-init.js"/></head><body><ToastProvider>{children}<StorageNotice/></ToastProvider></body></html>; }
