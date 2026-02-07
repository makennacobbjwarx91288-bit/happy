import { motion } from "framer-motion";

const BrandStory = () => {
  return (
    <section className="py-24 bg-charcoal text-cream">
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Text Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <p className="text-warm-gold uppercase tracking-[0.2em] text-sm font-medium">
              Our Story
            </p>
            <h2 className="font-serif text-4xl md:text-5xl leading-tight">
              Crafted for the <br />
              <span className="text-warm-gold">Modern Gentleman</span>
            </h2>
            <div className="space-y-4 text-cream/80 leading-relaxed">
              <p>
                Founded with a simple mission: to create premium grooming products 
                that help men look and feel their best. We believe that self-care 
                isn't just about appearance—it's about confidence, routine, and 
                taking pride in who you are.
              </p>
              <p>
                Every product in our collection is meticulously crafted using 
                the finest natural ingredients, sourced from around the world 
                and blended by expert craftsmen who share our passion for quality.
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="mt-4 px-8 py-3 border border-warm-gold text-warm-gold hover:bg-warm-gold hover:text-charcoal transition-colors duration-300 uppercase tracking-wider text-sm font-medium"
            >
              Learn More
            </motion.button>
          </motion.div>

          {/* Image Grid */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid grid-cols-2 gap-4"
          >
            <div className="space-y-4">
              <div className="aspect-[3/4] bg-cream/10 overflow-hidden">
                <div className="w-full h-full bg-gradient-to-br from-warm-gold/20 to-transparent flex items-center justify-center">
                  <span className="font-serif text-6xl text-warm-gold/30">01</span>
                </div>
              </div>
              <div className="aspect-square bg-cream/10 overflow-hidden">
                <div className="w-full h-full bg-gradient-to-br from-cream/10 to-transparent flex items-center justify-center">
                  <span className="font-serif text-4xl text-cream/30">02</span>
                </div>
              </div>
            </div>
            <div className="space-y-4 pt-8">
              <div className="aspect-square bg-cream/10 overflow-hidden">
                <div className="w-full h-full bg-gradient-to-br from-warm-gold/10 to-transparent flex items-center justify-center">
                  <span className="font-serif text-4xl text-warm-gold/30">03</span>
                </div>
              </div>
              <div className="aspect-[3/4] bg-cream/10 overflow-hidden">
                <div className="w-full h-full bg-gradient-to-br from-cream/10 to-transparent flex items-center justify-center">
                  <span className="font-serif text-6xl text-cream/30">04</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-20 pt-12 border-t border-cream/20"
        >
          {[
            { number: "10+", label: "Years of Excellence" },
            { number: "50K+", label: "Happy Customers" },
            { number: "100%", label: "Natural Ingredients" },
            { number: "24", label: "Countries Shipped" },
          ].map((stat, index) => (
            <div key={stat.label} className="text-center">
              <p className="font-serif text-4xl md:text-5xl text-warm-gold mb-2">
                {stat.number}
              </p>
              <p className="text-cream/60 text-sm uppercase tracking-wider">
                {stat.label}
              </p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default BrandStory;
