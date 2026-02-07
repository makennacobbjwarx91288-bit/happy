import { motion } from "framer-motion";

const Hero = () => {
  return (
    <section className="min-h-[60vh] flex items-center justify-center px-6 py-20">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="max-w-4xl"
      >
        <h1 className="heading-italic text-4xl md:text-5xl lg:text-6xl xl:text-7xl leading-tight">
          <span className="text-highlight">Beard Atelier is a fragrance house</span>
          <br />
          <span className="text-highlight mt-2 inline-block">disguised as a beard care company.</span>
        </h1>
      </motion.div>
    </section>
  );
};

export default Hero;
