import { redirect } from 'next/navigation';

export default async function NewRentalRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/rentals/new?client=${encodeURIComponent(id)}`);
}
