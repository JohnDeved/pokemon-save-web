import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

export interface PopoverProps {
    isOpen: boolean;
    opensUpward?: boolean;
    children: React.ReactNode;
    className?: string;
}

export const Popover: React.FC<PopoverProps> = ({ 
    isOpen, 
    opensUpward = false, 
    children, 
    className 
}) => {
    const popoverDirectionClass = opensUpward ? "bottom-full mb-1" : "top-full mt-1";
    const animationY = opensUpward ? 10 : -10;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    layout
                    initial={{ opacity: 0, y: animationY }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: animationY }}
                    className={cn(
                        "absolute left-0 right-0 z-50 p-3 bg-slate-900 border border-slate-700 rounded-lg shadow-xl text-xs",
                        popoverDirectionClass,
                        className
                    )}
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    );
};
