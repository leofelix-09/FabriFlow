import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({
  label,
  error,
  className = '',
  ...props
}: InputProps) {
  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {props.required && <span className="text-danger-500 ml-1">*</span>}
        </label>
      )}
      <input
        className={`
          block w-full px-3 py-2 rounded-lg text-sm
          placeholder-gray-400 transition-colors
          focus:outline-none focus:ring-2 focus:ring-primary-500
          disabled:bg-gray-50 disabled:cursor-not-allowed
          ${error ? 'focus:ring-danger-500' : 'border border-gray-200'}
        `}
        {...props}
      />
      {error && (
        <p className="text-sm text-danger-600">{error}</p>
      )}
    </div>
  );
}
