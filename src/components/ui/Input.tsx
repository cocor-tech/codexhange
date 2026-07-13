'use client';

import { InputHTMLAttributes } from 'react';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function Input({ label, value, onChange, type = 'text', placeholder, disabled, inputMode, className, ...rest }: InputProps) {
  return (
    <div className={className}>
      {label && <label className="mb-1.5 block text-sm font-medium text-[--text-secondary]">{label}</label>}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        inputMode={inputMode}
        className="input-glass"
        {...rest}
      />
    </div>
  );
}
