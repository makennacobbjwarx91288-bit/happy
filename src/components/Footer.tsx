import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useShop } from "@/context/ShopContext";

const Footer = () => {
  const { config } = useShop();
  const shopName = config?.name || "Shop";

  const socialLinks = [
    { name: "Twitter", href: "#" },
    { name: "Facebook", href: "#" },
    { name: "YouTube", href: "#" },
    { name: "Instagram", href: "#" },
    { name: "TikTok", href: "#" },
  ];

  const footerLinks = [
    {
      title: "Shop",
      links: [
        { label: "Beard", path: "/beard" },
        { label: "Hair", path: "/hair" },
        { label: "Body", path: "/body" },
        { label: "Fragrances", path: "/fragrances" },
        { label: "Bundles", path: "/bundles" },
      ],
    },
    {
      title: "Support",
      links: [
        { label: "Contact Us", path: "/contact" },
        { label: "Shipping", path: "/shipping" },
        { label: "Returns", path: "/returns" },
        { label: "FAQ", path: "/faq" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About", path: "/about" },
        { label: "Blog", path: "/blog" },
        { label: "Careers", path: "/careers" },
        { label: "Press", path: "/press" },
      ],
    },
  ];

  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-6">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="flex items-center"
            >
               <div className="h-12 w-32 bg-primary-foreground/10 flex items-center justify-center text-xs text-primary-foreground/50 border border-dashed border-primary-foreground/30">
                  LOGO PENDING
               </div>
            </motion.div>
            <p className="text-primary-foreground/80 max-w-xs">
              {shopName} is a fragrance house disguised as a beard care company.
            </p>
            <p className="font-serif text-xl tracking-wide">
              Keep on Growing<sup>®</sup>
            </p>
          </div>

          {/* Link Columns */}
          {footerLinks.map((column) => (
            <div key={column.title}>
              <h4 className="font-medium tracking-widest text-sm uppercase mb-4">
                {column.title}
              </h4>
              <ul className="space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.path}
                      className="text-primary-foreground/70 hover:text-primary-foreground transition-colors text-sm"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Section */}
        <div className="mt-16 pt-8 border-t border-primary-foreground/20">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-sm text-primary-foreground/60">
              © 2026 {shopName}. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                >
                  {social.name}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
