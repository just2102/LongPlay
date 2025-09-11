import fs from "fs";

function extractAVSAbi() {
  console.log("Extracting RangeExitManagerService ABI");

  const path =
    "../avs/out/RangeExitManagerService.sol/RangeExitManagerService.json";
  const abi = JSON.parse(fs.readFileSync(path, "utf8")).abi;
  if (!abi) {
    throw new Error("Abi not found");
  }

  const savePath = "../avs/abis/RangeExitManagerService.json";
  fs.writeFileSync(savePath, JSON.stringify(abi, null, 2));
  console.log("Abi saved to", savePath);
}

extractAVSAbi();
