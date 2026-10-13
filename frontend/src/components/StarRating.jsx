import React, { useState } from 'react';
import { Star } from 'lucide-react';

const sizeMap = {
  xs: 12,
  sm: 14,
  md: 18,
  lg: 24,
  xl: 32,
};

const RATING_LABELS = {
  1: 'Very Poor',
  2: 'Poor',
  3: 'Average',
  4: 'Good',
  5: 'Excellent',
};

const StarRating = ({
  rating = 0,
  maxRating = 5,
  interactive = false,
  onRatingChange,
  size = 'md',
  showValue = false,
  showLabel = false,
  count,
  className = '',
}) => {
  const [hoverRating, setHoverRating] = useState(0);
  const iconSize = sizeMap[size] || 18;
  const currentRating = interactive && hoverRating > 0 ? hoverRating : rating;

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <div
        className="inline-flex items-center gap-0.5"
        onMouseLeave={() => interactive && setHoverRating(0)}
      >
        {Array.from({ length: maxRating }, (_, idx) => {
          const starValue = idx + 1;
          const isFilled = currentRating >= starValue;
          const isHalf = !isFilled && currentRating >= starValue - 0.5;

          return (
            <button
              key={starValue}
              type="button"
              disabled={!interactive}
              aria-label={`${starValue} of ${maxRating} stars`}
              className={`transition-all duration-150 ${
                interactive
                  ? 'cursor-pointer hover:scale-115 focus:outline-hidden'
                  : 'cursor-default pointer-events-none'
              }`}
              onMouseEnter={() => interactive && setHoverRating(starValue)}
              onClick={() => interactive && onRatingChange && onRatingChange(starValue)}
            >
              <Star
                size={iconSize}
                className={`transition-colors duration-150 ${
                  isFilled
                    ? 'fill-amber-400 text-amber-400 drop-shadow-[0_1px_3px_rgba(251,191,36,0.4)]'
                    : isHalf
                    ? 'fill-amber-400/50 text-amber-400'
                    : 'fill-slate-100 text-slate-300'
                }`}
              />
            </button>
          );
        })}
      </div>

      {showValue && (
        <span className="font-bold text-slate-800 text-sm">
          {Number(rating || 0).toFixed(1)}
        </span>
      )}

      {showLabel && interactive && currentRating > 0 && (
        <span className="text-xs font-semibold text-amber-600 ml-1">
          {RATING_LABELS[currentRating] || ''}
        </span>
      )}

      {count !== undefined && (
        <span className="text-xs text-slate-500 font-medium">
          ({count})
        </span>
      )}
    </div>
  );
};

export default StarRating;
