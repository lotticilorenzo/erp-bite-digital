import React from "react";
import { motion } from "framer-motion";

interface PageTransitionProps {
  children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -15, scale: 0.99 }}
      transition={{
        duration: 0.15,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="w-full h-full"
    >
      {children}
    </motion.div>
  );
}
