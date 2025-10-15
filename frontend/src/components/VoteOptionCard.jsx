import React from 'react';
import { Check, Circle } from 'lucide-react';

const VoteOptionCard = ({ option, isSelected, onSelect, disabled, index }) => {
  return (
    <div
      className={`
        relative rounded-lg border-2 p-4 cursor-pointer transition-all duration-200
        ${isSelected
          ? 'border-primary-500 bg-primary-50 shadow-md'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      onClick={disabled ? undefined : onSelect}
    >
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0">
          {isSelected ? (
            <div className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center">
              <Check className="w-4 h-4 text-white" />
            </div>
          ) : (
            <Circle className="w-6 h-6 text-gray-300" />
          )}
        </div>
        
        <div className="flex-1">
          <div className="flex items-center">
            <span className="text-sm font-medium text-gray-500 mr-3">
              {String.fromCharCode(65 + index)}.
            </span>
            <p className={`text-base font-medium ${isSelected ? 'text-primary-900' : 'text-gray-900'}`}>
              {option}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoteOptionCard;
