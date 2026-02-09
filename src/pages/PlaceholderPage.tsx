interface PlaceholderPageProps {
  title?: string;
}

const PlaceholderPage = ({ title = "Coming Soon" }: PlaceholderPageProps) => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 px-4">
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">This page is under construction.</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default PlaceholderPage;
