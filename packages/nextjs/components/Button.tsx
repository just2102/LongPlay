import { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export const Button = ({ children, onClick, disabled, className = "" }: ButtonProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`btn transition-all ${className}
      bg-gray-900 text-white hover:bg-gray-800 shadow-md
      disabled:opacity-70 disabled:cursor-not-allowed disabled:shadow-none
      `}
    >
      {children}
    </button>
  );
};
