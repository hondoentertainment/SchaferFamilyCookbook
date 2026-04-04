import React, { useState } from 'react';
import { hapticLight } from '../utils/haptics';

interface StarRatingProps {
  rating: number;
  onRate?: (rating: number) => void;
  size?: 'sm' | 'md' | 'lg';
  showCount?: number;
  readOnly?: boolean;
}

export const StarRating: React.FC<StarRatingProps> = ({
  rating,
  onRate,
  size = 'md',
  showCount,
  readOnly = false,
}) => {
  const [hover, setHover] = useState(0);

  const sizeClass = {
    sm: 'text-base gap-0.5',
    md: 'text-xl gap-1',
    lg: 'text-2xl gap-1',
  }[size];

  return (
    <div className={`flex items-center ${sizeClass}`} role="group" aria-label={`Rating: ${rating.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = hover > 0 ? star <= hover : star <= Math.round(rating);
        return (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            onClick={() => {
              if (onRate) {
                hapticLight();
                onRate(star);
              }
            }}
            onMouseEnter={() => !readOnly && setHover(star)}
            onMouseLeave={() => setHover(0)}
            className={`transition-transform ${
              readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-125 active:scale-90'
            } ${filled ? 'text-amber-400' : 'text-stone-300 dark:text-stone-600'} focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded`}
            aria-label={`${star} star${star !== 1 ? 's' : ''}`}
          >
            {filled ? '★' : '☆'}
          </button>
        );
      })}
      {showCount !== undefined && (
        <span className="text-xs text-stone-500 ml-1">({showCount})</span>
      )}
    </div>
  );
};
