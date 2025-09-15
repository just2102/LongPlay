import { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  variant?: "primary" | "secondary";
  rounded?: "full" | "lg";
}

export const Button = ({
  children,
  onClick,
  disabled,
  className = "",
  variant = "primary",
  rounded = "lg",
}: ButtonProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`btn transition-all ${className}
      shadow-md disabled:opacity-70 disabled:cursor-not-allowed disabled:shadow-none text-white
      ${variant === "primary" ? "bg-gray-900 hover:bg-gray-800 " : ""},
      ${variant === "secondary" ? "hover:bg-gray-50 !text-gray-700 border-gray-300" : ""},
      ${rounded === "full" ? "rounded-full" : "rounded-lg"}
      `}
    >
      {children}
    </button>
  );
};
