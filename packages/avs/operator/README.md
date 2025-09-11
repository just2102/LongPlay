`npx tsx index.ts` to run the script

Operator (AVS backend)

This service listens for Uniswap V4 hook events and coordinates with the AVS contract to update user positions.

Flows (scaffolded):

- Price change scenario

  1. Hook `beforeInitialize` records ticks of supported pairs (onchain/hook side).
  2. Price in Uniswap V4 pair changes.
  3. Hook `afterSwap` emits `WithdrawNeeded`.
  4. Operator subscribes to `WithdrawNeeded` (see `index.ts`).
  5. Operator discovers valid positions via static calls (`isOperator()`, `balanceOf()`).
  6. Operator calls AVS `modifyPositions(task, positions)` to update user positions.
  7. AVS contract executes strategy (burn from Uniswap, supply to Aave).
  8. Operator continues batching if needed via `continueModifyPositions`.

- Delegation cancellation scenario
  1. User cancels approval of LP token to AVS.
  2. User calls AVS `cancelDelegation(positionId, posM)`.
  3. AVS refunds leftover native minus subscription.

Files to implement next:

- `services/positionDiscovery.ts`: discover and filter candidate positions.
- `services/avsClient.ts`: type-safe client to call AVS functions.
- `integrations/uniswap.ts`: helpers to build pool keys and read ticks.
- `integrations/aave.ts`: helpers to supply/withdraw on Aave.
- `flows/priceChange.ts`: orchestrate the price-change flow.

Environment variables expected: see `index.ts`.
