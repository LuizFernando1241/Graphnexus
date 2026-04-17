import { useRef } from "react";
import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { vibrate } from "@/lib/vibrate";
import type { LucideIcon } from "lucide-react";

interface SwipeableItemProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  leftBgColor?: string;
  rightBgColor?: string;
}

const THRESHOLD = 80;

export function SwipeableItem({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  leftBgColor = "bg-destructive",
  rightBgColor = "bg-success",
}: SwipeableItemProps) {
  const x = useMotionValue(0);
  const fired = useRef(false);

  // Icon opacity based on drag distance
  const rightIconOpacity = useTransform(x, [0, THRESHOLD], [0, 1]);
  const leftIconOpacity = useTransform(x, [-THRESHOLD, 0], [1, 0]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > THRESHOLD && onSwipeRight) {
      vibrate(50);
      onSwipeRight();
    } else if (info.offset.x < -THRESHOLD && onSwipeLeft) {
      vibrate(50);
      onSwipeLeft();
    }
    fired.current = false;
  };

  return (
    <div className="relative overflow-hidden rounded-lg touch-pan-y">
      {/* Background layers */}
      {RightIcon && (
        <motion.div
          className={`absolute inset-0 flex items-center pl-4 ${rightBgColor}`}
          style={{ opacity: rightIconOpacity }}
        >
          <RightIcon className="h-5 w-5 text-primary-foreground" />
        </motion.div>
      )}
      {LeftIcon && (
        <motion.div
          className={`absolute inset-0 flex items-center justify-end pr-4 ${leftBgColor}`}
          style={{ opacity: leftIconOpacity }}
        >
          <LeftIcon className="h-5 w-5 text-primary-foreground" />
        </motion.div>
      )}

      {/* Draggable content */}
      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.7}
        onDragEnd={handleDragEnd}
        className="relative z-10 bg-card"
      >
        {children}
      </motion.div>
    </div>
  );
}
