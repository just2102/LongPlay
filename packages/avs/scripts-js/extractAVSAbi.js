import fs from "fs";

function extractAVSAbi() {
  console.log("Extracting RangeExitManagerService ABI");

  const path =
    "../avs/out/RangeExitManagerService.sol/RangeExitManagerService.json";
  const abi = JSON.parse(fs.readFileSync(path, "utf8")).abi;
  if (!abi) {
    throw new Error("Abi not found");
  }

  const savePath1 = "../avs/abis/RangeExitManagerService.json";
  fs.writeFileSync(savePath1, JSON.stringify(abi, null, 2));
  console.log("Abi saved to", savePath1);

  const savePath2 = "../avs/operator/abis/RangeExitManagerService.json";
  fs.writeFileSync(savePath2, JSON.stringify(abi, null, 2));
  console.log("Abi saved to", savePath2);
}

extractAVSAbi();
