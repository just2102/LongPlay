import fs from "fs";

function extractHookAbi() {
  console.log("Extracting hook ABI");

  const path = "../foundry/out/LPRebalanceHook.sol/LPRebalanceHook.json";
  const abi = JSON.parse(fs.readFileSync(path, "utf8")).abi;
  if (!abi) {
    throw new Error("Abi not found");
  }

  const savePath1 = "../foundry/abis/LPRebalanceHook.abi.json";
  fs.writeFileSync(savePath1, JSON.stringify(abi, null, 2));
  console.log("Abi saved to", savePath1);

  const savePath2 = "../avs/operator/abis/LPRebalanceHook.abi.json";
  fs.writeFileSync(savePath2, JSON.stringify(abi, null, 2));
  console.log("Abi saved to", savePath2);
}

extractHookAbi();
