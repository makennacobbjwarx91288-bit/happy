import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Link } from "react-router-dom";

export type SupportKind = "contact" | "shipping" | "returns" | "faq";

interface SupportPageProps {
  kind: SupportKind;
}

const PAGE_META: Record<SupportKind, { title: string; subtitle: string; badge: string }> = {
  contact: {
    title: "Contact Us",
    subtitle: "Our support team is here to help with orders, products, and account questions.",
    badge: "Support",
  },
  shipping: {
    title: "Shipping Policy",
    subtitle: "Simple delivery timelines and transparent shipping updates.",
    badge: "Logistics",
  },
  returns: {
    title: "Returns & Exchanges",
    subtitle: "Clear return steps so you can shop with confidence.",
    badge: "Policy",
  },
  faq: {
    title: "Frequently Asked Questions",
    subtitle: "Quick answers to common checkout, shipping, and product questions.",
    badge: "Help Center",
  },
};

const FAQ_ITEMS = [
  {
    id: "faq-1",
    q: "How long does shipping take?",
    a: "Most domestic orders arrive in 3-5 business days after fulfillment. You will receive tracking details by email once your order ships.",
  },
  {
    id: "faq-2",
    q: "Can I change my order after checkout?",
    a: "Yes, as long as the order has not shipped. Contact support with your order number and requested changes as soon as possible.",
  },
  {
    id: "faq-3",
    q: "Do you offer international shipping?",
    a: "International shipping is available in selected regions. Rates and delivery windows are shown at checkout based on destination.",
  },
  {
    id: "faq-4",
    q: "What if my package is delayed?",
    a: "If tracking has not moved for 5+ business days, reach out to support and we will open a carrier trace for you.",
  },
];

const SupportPage = ({ kind }: SupportPageProps) => {
  const meta = PAGE_META[kind];
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    orderNumber: "",
    message: "",
  });

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setContactSubmitted(true);
  };

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
          {kind === "contact" && (
            <div className="grid lg:grid-cols-5 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Email</CardTitle>
                    <CardDescription>Replies within 12 hours.</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm">
                    support@beardatelier.co
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Phone</CardTitle>
                    <CardDescription>Mon-Fri, 9:00-18:00.</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm">
                    +1 (800) 555-0134
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Order Support</CardTitle>
                    <CardDescription>Keep your order number ready for faster processing.</CardDescription>
                  </CardHeader>
                </Card>
              </div>

              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>Send A Message</CardTitle>
                  <CardDescription>We will follow up by email.</CardDescription>
                </CardHeader>
                <CardContent>
                  {contactSubmitted ? (
                    <div className="space-y-4">
                      <p className="text-green-700 bg-green-50 border border-green-200 rounded-md px-4 py-3">
                        Message received. Our team will get back to you soon.
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setContactSubmitted(false);
                          setForm({ name: "", email: "", orderNumber: "", message: "" });
                        }}
                      >
                        Send Another Message
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleContactSubmit} className="space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Name</Label>
                          <Input
                            id="name"
                            value={form.name}
                            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={form.email}
                            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="orderNumber">Order Number (Optional)</Label>
                        <Input
                          id="orderNumber"
                          value={form.orderNumber}
                          onChange={(e) => setForm((prev) => ({ ...prev, orderNumber: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="message">Message</Label>
                        <Textarea
                          id="message"
                          value={form.message}
                          onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
                          rows={6}
                          required
                        />
                      </div>
                      <Button type="submit">Submit</Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {kind === "shipping" && (
            <div className="grid lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Processing Time</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Orders are typically processed in 1-2 business days.
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Standard Delivery</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  3-5 business days within the US after fulfillment.
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Priority Delivery</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  1-2 business days in eligible regions.
                </CardContent>
              </Card>
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>Shipping Notes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>Free standard shipping applies to qualifying orders over $30.</p>
                  <p>Carrier delays caused by weather or local disruptions may affect final delivery dates.</p>
                  <p>Address updates can be requested before shipment confirmation.</p>
                </CardContent>
              </Card>
            </div>
          )}

          {kind === "returns" && (
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Return Window</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Returns are accepted within 30 days of delivery for eligible items.
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Exchange Eligibility</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Exchanges are available for unopened or defective products.
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>How To Return</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>1. Contact support with your order number and return reason.</p>
                  <p>2. Receive a return authorization and shipping instructions.</p>
                  <p>3. Once received and inspected, refund is issued to the original payment method.</p>
                </CardContent>
              </Card>
            </div>
          )}

          {kind === "faq" && (
            <div className="max-w-3xl mx-auto space-y-8">
              <Accordion type="single" collapsible className="w-full">
                {FAQ_ITEMS.map((item) => (
                  <AccordionItem key={item.id} value={item.id}>
                    <AccordionTrigger>{item.q}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              <Card>
                <CardHeader>
                  <CardTitle>Still Need Help?</CardTitle>
                  <CardDescription>Send us a message and we will follow up quickly.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild>
                    <Link to="/contact">Contact Support</Link>
                  </Button>
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

export default SupportPage;
