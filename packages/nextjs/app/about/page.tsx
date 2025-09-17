export default function AboutPage() {
  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-[1200px]">
        <h1 className="text-center text-2xl font-bold mb-8 text-gray-900">
          LongPlay: Automated Liquidity Management Flow
        </h1>

        <div className="relative rounded-2xl border border-gray-200 bg-white shadow-sm p-8">
          {/* Actors */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4 mb-10">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-center">
              <div className="text-2xl mb-1">👤</div>
              <div className="text-gray-900 text-base font-semibold mb-1">User</div>
              <div className="text-gray-500 text-sm">LP Provider</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-center">
              <div className="text-2xl mb-1">🪝</div>
              <div className="text-gray-900 text-base font-semibold mb-1">Uniswap v4 Hook</div>
              <div className="text-gray-500 text-sm">Price Tracker</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-center">
              <div className="text-2xl mb-1">🛡️</div>
              <div className="text-gray-900 text-base font-semibold mb-1">AVS Service</div>
              <div className="text-gray-500 text-sm">EigenLayer Validator</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-center">
              <div className="text-2xl mb-1">⚙️</div>
              <div className="text-gray-900 text-base font-semibold mb-1">Operator</div>
              <div className="text-gray-500 text-sm">Off-chain Executor</div>
            </div>
          </div>

          {/* Flow Steps */}
          <div className="relative mt-6 space-y-6">
            {/* Step 1 */}
            <div className="relative flex items-start gap-5">
              <div className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-gray-900 text-white text-sm font-semibold">
                1
              </div>
              <div className="absolute left-4 top-10 -bottom-5 w-px bg-gradient-to-b from-gray-300 to-transparent" />
              <div className="ml-6 flex-1 rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-gray-300 hover:shadow-sm">
                <div className="mb-2 flex items-center gap-2 text-gray-900 text-base font-semibold">
                  Position Configuration{" "}
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700 text-xs font-medium">
                    User → AVS
                  </span>
                </div>
                <p className="text-gray-600 mb-2">
                  User configures their position with a tick threshold and strategy choice (e.g., supply to Aave). Pays
                  a flat service fee (0.0001 ETH) and approves AVS to manage position.
                </p>
                <div className="font-mono text-gray-700 text-xs bg-gray-50 border border-gray-200 rounded-md p-2">
                  configurePosition(tickThreshold, strategyId, positionId, posM, ...)
                  <span className="ml-2 inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700 text-[10px]">
                    Event: PositionConfigured
                  </span>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative flex items-start gap-5">
              <div className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-gray-900 text-white text-sm font-semibold">
                2
              </div>
              <div className="absolute left-4 top-10 -bottom-5 w-px bg-gradient-to-b from-gray-300 to-transparent" />
              <div className="ml-6 flex-1 rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-gray-300 hover:shadow-sm">
                <div className="mb-2 flex items-center gap-2 text-gray-900 text-base font-semibold">
                  Price Movement Detection{" "}
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700 text-xs font-medium">
                    Hook
                  </span>
                </div>
                <p className="text-gray-600 mb-2">
                  On every swap, the Hook tracks price changes by comparing current tick with last tick. When movement
                  detected, creates a task for the AVS service.
                </p>
                <div className="font-mono text-gray-700 text-xs bg-gray-50 border border-gray-200 rounded-md p-2">
                  afterSwap() → getCurrentTick() → createNewTask()
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative flex items-start gap-5">
              <div className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-gray-900 text-white text-sm font-semibold">
                3
              </div>
              <div className="absolute left-4 top-10 -bottom-5 w-px bg-gradient-to-b from-gray-300 to-transparent" />
              <div className="ml-6 flex-1 rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-gray-300 hover:shadow-sm">
                <div className="mb-2 flex items-center gap-2 text-gray-900 text-base font-semibold">
                  Task Emission{" "}
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700 text-xs font-medium">
                    AVS Service
                  </span>
                </div>
                <p className="text-gray-600 mb-2">
                  Service receives task from Hook and emits WithdrawNeeded event with pool context, last tick, and
                  deadline for operator to process.
                </p>
                <div className="font-mono text-gray-700 text-xs bg-gray-50 border border-gray-200 rounded-md p-2">
                  createNewTask(poolKey, lastTick, deadline, poolId)
                  <span className="ml-2 inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700 text-[10px]">
                    Event: WithdrawNeeded
                  </span>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="relative flex items-start gap-5">
              <div className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-gray-900 text-white text-sm font-semibold">
                4
              </div>
              <div className="absolute left-4 top-10 -bottom-5 w-px bg-gradient-to-b from-gray-300 to-transparent" />
              <div className="ml-6 flex-1 rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-gray-300 hover:shadow-sm">
                <div className="mb-2 flex items-center gap-2 text-gray-900 text-base font-semibold">
                  Position Discovery{" "}
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700 text-xs font-medium">
                    Operator
                  </span>
                </div>
                <p className="text-gray-600 mb-2">
                  Operator listens to WithdrawNeeded events, computes eligible tick thresholds between lastTick and
                  currentTick, discovers all matching user positions from cache.
                </p>
                <div className="font-mono text-gray-700 text-xs bg-gray-50 border border-gray-200 rounded-md p-2">
                  computeThresholdBounds() → discoverValidPositions() → loadConfigs()
                </div>
              </div>
            </div>

            {/* Step 5 */}
            <div className="relative flex items-start gap-5">
              <div className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-gray-900 text-white text-sm font-semibold">
                5
              </div>
              <div className="absolute left-4 top-10 -bottom-5 w-px bg-gradient-to-b from-gray-300 to-transparent" />
              <div className="ml-6 flex-1 rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-gray-300 hover:shadow-sm">
                <div className="mb-2 flex items-center gap-2 text-gray-900 text-base font-semibold">
                  Liquidity Withdrawal & Strategy Execution{" "}
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700 text-xs font-medium">
                    Operator → AVS
                  </span>
                </div>
                <p className="text-gray-600 mb-2">
                  Operator signs and calls withdrawLiquidity with validated configs. AVS burns LP positions, realizes
                  token balances, and executes chosen strategies.
                </p>
                <div className="font-mono text-gray-700 text-xs bg-gray-50 border border-gray-200 rounded-md p-2">
                  withdrawLiquidity(task, taskIndex, configs, signature)
                  <span className="mx-2">→</span> burnPosition() <span className="mx-2">→</span> applyStrategy()
                  <span className="ml-2 inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700 text-[10px]">
                    Event: PositionBurned
                  </span>
                </div>
              </div>
            </div>

            {/* Step 6 */}
            <div className="relative flex items-start gap-5">
              <div className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-gray-900 text-white text-sm font-semibold">
                6
              </div>
              <div className="ml-6 flex-1 rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-gray-300 hover:shadow-sm">
                <div className="mb-2 flex items-center gap-2 text-gray-900 text-base font-semibold">
                  Strategy Application{" "}
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700 text-xs font-medium">
                    AVS → DeFi Protocol
                  </span>
                </div>
                <p className="text-gray-600 mb-2">
                  Based on user&apos;s configured strategy, AVS supplies withdrawn assets to external protocols (e.g.,
                  Aave) or executes other strategies. User can opt-out anytime via cancelDelegation.
                </p>
                <div className="font-mono text-gray-700 text-xs bg-gray-50 border border-gray-200 rounded-md p-2">
                  AAVE_POOL.supply(asset, amount, onBehalfOf, ...)
                  <span className="ml-2 inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700 text-[10px]">
                    Event: SupplySuccess/SupplyFailed
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
