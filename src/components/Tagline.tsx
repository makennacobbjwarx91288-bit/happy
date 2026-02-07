import { motion } from "framer-motion";

const Tagline = () => {
  return (
    <section className="py-16 border-t border-b border-border">
      <motion.h2
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center font-serif text-3xl md:text-4xl lg:text-5xl tracking-wider"
      >
        KEEP ON GROWING<sup className="text-lg">®</sup>
      </motion.h2>
    </section>
  );
};

export default Tagline;
