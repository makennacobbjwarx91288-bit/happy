import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type CompanyKind = "about" | "blog" | "careers" | "press";

interface CompanyPageProps {
  kind: CompanyKind;
}

const PAGE_META: Record<CompanyKind, { title: string; subtitle: string; badge: string }> = {
  about: {
    title: "About Us",
    subtitle: "Built on quality ingredients, practical routines, and customer-first service.",
    badge: "Company",
  },
  blog: {
    title: "Blog",
    subtitle: "Grooming guides, product tips, and stories from our team.",
    badge: "Journal",
  },
  careers: {
    title: "Careers",
    subtitle: "Join a focused team building a modern grooming brand.",
    badge: "Hiring",
  },
  press: {
    title: "Press",
    subtitle: "Brand assets, announcements, and media contact details.",
    badge: "Media",
  },
};

const BLOG_POSTS = [
  {
    id: "post-1",
    title: "The 5-Minute Morning Beard Routine",
    category: "Routine",
    excerpt: "A simple daily sequence to keep your beard clean, soft, and shaped.",
  },
  {
    id: "post-2",
    title: "How To Layer Fragrance With Beard Oil",
    category: "Fragrance",
    excerpt: "Use scent families to create balanced and long-lasting combinations.",
  },
  {
    id: "post-3",
    title: "Winter Skin Recovery Guide",
    category: "Skin",
    excerpt: "Repair dryness and irritation with lightweight hydration habits.",
  },
];

const JOB_OPENINGS = [
  {
    id: "job-1",
    role: "Lifecycle Marketing Specialist",
    location: "Remote - US",
    type: "Full-time",
  },
  {
    id: "job-2",
    role: "Frontend Engineer (React)",
    location: "Remote - US",
    type: "Full-time",
  },
  {
    id: "job-3",
    role: "Customer Experience Lead",
    location: "Austin, TX",
    type: "Full-time",
  },
];

const CompanyPage = ({ kind }: CompanyPageProps) => {
  const meta = PAGE_META[kind];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1">
        <section className="border-b bg-secondary/25">
          <div className="container mx-auto px-6 py-16 md:py-20 max-w-4xl">
            <Badge variant="outline" className="tracking-widest uppercase text-[11px] px-3 py-1">
              {meta.badge}
            </Badge>
            <h1 className="font-serif text-4xl md:text-5xl mt-5">{meta.title}</h1>
            <p className="text-muted-foreground text-lg leading-relaxed mt-4">{meta.subtitle}</p>
          </div>
        </section>

        <section className="container mx-auto px-6 py-14">
          {kind === "about" && (
            <div className="grid lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle>What We Build</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-muted-foreground">
                  <p>We design practical products for beard, hair, body, and fragrance routines.</p>
                  <p>Our formula philosophy is straightforward: high-performance ingredients, clean textures, and balanced scents.</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>How We Work</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-muted-foreground">
                  <p>We iterate with customer feedback first, then optimize packaging and process for consistency.</p>
                  <p>Support and fulfillment are treated as part of the product experience, not an afterthought.</p>
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Core Values</CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-3 gap-4">
                  <div className="border rounded-md p-4">
                    <h3 className="font-semibold mb-2">Clarity</h3>
                    <p className="text-sm text-muted-foreground">Clear labels, clear routines, clear support.</p>
                  </div>
                  <div className="border rounded-md p-4">
                    <h3 className="font-semibold mb-2">Craft</h3>
                    <p className="text-sm text-muted-foreground">Thoughtful formulas and repeatable quality control.</p>
                  </div>
                  <div className="border rounded-md p-4">
                    <h3 className="font-semibold mb-2">Consistency</h3>
                    <p className="text-sm text-muted-foreground">Reliable results in daily use, not just first impressions.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {kind === "blog" && (
            <div className="grid lg:grid-cols-3 gap-6">
              {BLOG_POSTS.map((post) => (
                <Card key={post.id} className="h-full">
                  <CardHeader>
                    <Badge variant="secondary" className="w-fit">{post.category}</Badge>
                    <CardTitle className="text-2xl">{post.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">{post.excerpt}</p>
                    <Button variant="outline">Read Article</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {kind === "careers" && (
            <div className="space-y-6">
              {JOB_OPENINGS.map((job) => (
                <Card key={job.id}>
                  <CardContent className="py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold">{job.role}</h3>
                      <p className="text-muted-foreground text-sm mt-1">{job.location} · {job.type}</p>
                    </div>
                    <Button>Apply Now</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {kind === "press" && (
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Media Contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-muted-foreground">
                  <p>press@beardatelier.co</p>
                  <p>+1 (800) 555-0119</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Press Kit</CardTitle>
                  <CardDescription>Logos, product imagery, and brand guidelines.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline">Download Assets</Button>
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Recent Highlights</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-muted-foreground">
                  <p>Featured in grooming roundups for product consistency and scent quality.</p>
                  <p>Recognized for streamlined ecommerce workflow and customer response times.</p>
                  <p>Expanding retail partnerships across select US metro areas.</p>
                </CardContent>
              </Card>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default CompanyPage;
