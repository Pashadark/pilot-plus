import '../account.css';
import AccountPanel from '../account-panel';
import {notFound} from 'next/navigation';

export const metadata = { title: 'Проверка заявок — TG CAR' };

export default function ReviewPage() {
  if(process.env.NODE_ENV==='production')notFound();
  return <AccountPanel mode="manager" />;
}
