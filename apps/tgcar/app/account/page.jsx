import '../account.css';
import AccountPanel from '../account-panel';
import {notFound} from 'next/navigation';

export const metadata = { title: 'Личный кабинет — TG CAR' };

export default function AccountPage() {
  if(process.env.NODE_ENV==='production')notFound();
  return <AccountPanel mode="client" />;
}
