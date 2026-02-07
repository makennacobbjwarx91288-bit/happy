import { motion } from "framer-motion";

interface ProductCardProps {
  image: string;
  title: string;
  price: string;
  description: string;
  index: number;
  onClick: () => void;
}

const ProductCard = ({ image, title, price, description, index, onClick }: ProductCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="group cursor-pointer transition-all duration-300"
      onClick={onClick}
    >
      <div className="aspect-[4/5] overflow-hidden bg-light-sage">
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="pt-4 space-y-1">
        <h3 className="font-serif text-xl">{title}</h3>
        <p className="text-muted-foreground font-medium">{price}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </motion.div>
  );
};

export default ProductCard;
