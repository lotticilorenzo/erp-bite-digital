export default function GenericPlaceholder({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
      <div className="h-16 w-16 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center">
        <span className="text-2xl font-bold text-primary italic">B</span>
      </div>
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="text-muted-foreground max-w-sm">
        Stiamo migrando questa sezione. Presto potrai gestire i tuoi {title.toLowerCase()} con la nuova interfaccia Bite ERP v4.
      </p>
    </div>
  );
}
