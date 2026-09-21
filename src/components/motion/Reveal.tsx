"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { useAnimationIntensity } from "@/components/motion/MotionProvider";
import { fadeUp, scaleReveal, staggerContainer } from "@/lib/motion";

interface RevealProps extends Omit<HTMLMotionProps<"div">, "variants" | "initial" | "whileInView"> {
  variant?: "fade-up" | "scale";
  delay?: number;
  once?: boolean;
}

/** Fades/slides an element up into view the first time it enters the viewport. */
export function Reveal({
  variant = "fade-up",
  delay = 0,
  once = true,
  children,
  ...rest
}: RevealProps) {
  const intensity = useAnimationIntensity();
  const variants = variant === "scale" ? scaleReveal(intensity) : fadeUp(intensity);

  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once, margin: "-10% 0px -10% 0px" }}
      variants={variants}
      transition={{ delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

interface StaggerProps extends Omit<HTMLMotionProps<"div">, "variants" | "initial" | "whileInView"> {
  once?: boolean;
}

/** Wrap children in <StaggerItem> to reveal them one after another. */
export function StaggerGroup({ once = true, children, ...rest }: StaggerProps) {
  const intensity = useAnimationIntensity();
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once, margin: "-10% 0px -10% 0px" }}
      variants={staggerContainer(intensity)}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, ...rest }: HTMLMotionProps<"div">) {
  const intensity = useAnimationIntensity();
  return (
    <motion.div variants={fadeUp(intensity)} {...rest}>
      {children}
    </motion.div>
  );
}
