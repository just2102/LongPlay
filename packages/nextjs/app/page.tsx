"use client";

import { AddLiquidityWidget } from "~~/components/AddLiquidityWidget";
import { MyPositions } from "~~/components/MyPositions";
import { PoolInfoDev } from "~~/components/PoolInfoDev";
import { isDevMode } from "~~/utils/featureFlags";

const Home = () => {
  return (
    <main className="relative flex flex-col flex-1 p-4">
      {isDevMode && <PoolInfoDev />}

      <AddLiquidityWidget />

      <MyPositions />
    </main>
  );
};

export default Home;
