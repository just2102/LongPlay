import fs from "fs";

function extractHookAbi() {
  console.log("Extracting hook ABI");

  const path = "../foundry/out/LPRebalanceHook.sol/LPRebalanceHook.json";
  const abi = JSON.parse(fs.readFileSync(path, "utf8")).abi;
  if (!abi) {
    throw new Error("Abi not found");
  }

  const savePath = "../foundry/abis/LPRebalanceHook.abi.json";
  fs.writeFileSync(savePath, JSON.stringify(abi, null, 2));
  console.log("Abi saved to", savePath);
}

extractHookAbi();
