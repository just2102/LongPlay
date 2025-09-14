interface CardBadgeProps {
  isActive: boolean;
  labelActive: string;
  labelInactive: string;
}
export const CardBadge = ({ isActive, labelActive, labelInactive }: CardBadgeProps) => {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${
          isActive ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
        }`}
      >
        {isActive ? labelActive : labelInactive}
      </span>
    </div>
  );
};
