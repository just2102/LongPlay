export const MyPositionsPlaceholder = () => {
  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold mb-6">My Positions</h2>
      <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
        <div className="mx-auto w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No positions yet</h3>
        <p className="text-gray-500 mb-4">Add liquidity to create your first position</p>
        <p className="text-sm text-gray-400">Your positions will appear here once you add liquidity to the pool</p>
      </div>
    </div>
  );
};
