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
      className={`btn bg-gray-950 text-gray-200 hover:bg-gray-800 transition-all ${className}
      disabled:text-gray-500
      `}
    >
      {children}
    </button>
  );
};
