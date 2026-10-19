import { redirect } from 'next/navigation';

export default async function SeasonPage({ params }: { params: Promise<{ id: string; season: string }> }) {
  const { id, season } = await params;
  redirect(`/show/${id}?season=${encodeURIComponent(season)}`);
}
