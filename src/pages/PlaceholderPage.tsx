import Header from "@/components/Header";
import Footer from "@/components/Footer";

const PlaceholderPage = ({ title }: { title: string }) => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-6 py-20">
        <h1 className="font-serif text-4xl md:text-5xl mb-6">{title}</h1>
        <div className="prose prose-lg">
          <p className="text-muted-foreground text-lg leading-relaxed">
            This is a placeholder page for <strong>{title}</strong>. 
            <br />
            Content for this section is coming soon as we continue to build out our store.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PlaceholderPage;
