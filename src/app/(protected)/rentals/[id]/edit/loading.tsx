export default function RentalEditLoading() {
  return (
    <main className="grid animate-pulse gap-5 p-6">
      <div className="h-10 w-72 rounded bg-slate-200" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-5">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-56 rounded-2xl bg-slate-200" />
          ))}
        </div>
        <div className="h-72 rounded-2xl bg-slate-200" />
      </div>
    </main>
  );
}
