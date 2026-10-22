"use client";

import { motion } from "framer-motion";

/* Плавная смена разделов бункера (template пересоздаётся на каждом переходе). */
export default function BunkerTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      // Только opacity: transform на обёртке сломал бы position: fixed у шторок и кнопки «+».
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
