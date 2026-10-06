import {StorageSettingsButton} from './storage-notice';
export default function LegalLayout({title,children}) {
 return <><header><a className="brand" href="/">TG <b>CAR</b></a><nav><a href="/#fleet">Автопарк</a><a href="/#contacts">Контакты</a></nav></header><main className="legal-page wrap"><a className="back" href="/">← На главную</a><h1>{title}</h1><p className="legal-version">Редакция от 20 сентября 2026 · информация о текущем предпросмотре</p>{children}</main><footer className="legal-footer wrap"><a href="/privacy">Обработка данных</a><a href="/cookies">Cookies и кеш</a><StorageSettingsButton/><a href="/">TG CAR</a></footer></>;
}
