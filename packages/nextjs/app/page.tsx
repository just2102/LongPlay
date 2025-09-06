"use client";

import { AddLiquidityWidget } from "~~/components/AddLiquidityWidget";
import { PoolInfoDev } from "~~/components/PoolInfoDev";
import { useMintPosition } from "~~/hooks/useMintPosition";
import { isDevMode } from "~~/utils/featureFlags";

const Home = () => {
  const {} = useMintPosition();

  return (
    <main className="relative flex flex-col flex-1 p-4">
      {isDevMode && <PoolInfoDev />}

      <AddLiquidityWidget />
    </main>
  );
};

export default Home;
