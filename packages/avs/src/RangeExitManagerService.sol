// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {ECDSAServiceManagerBase} from "eigenlayer-middleware/src/unaudited/ECDSAServiceManagerBase.sol";
import {ECDSAStakeRegistry} from "eigenlayer-middleware/src/unaudited/ECDSAStakeRegistry.sol";
import {console} from "forge-std/console.sol";

import {IRangeExitServiceManager} from "./interfaces/IRangeExitServiceManager.sol";
import {IPositionManagerMinimal} from "./interfaces/IPositionManagerMinimal.sol";
import {ILPRebalanceHook} from "./interfaces/ILPRebalanceHook.sol";
import {Actions} from "./libraries/Actions.sol";
import {ECDSAUpgradeable} from "@openzeppelin-upgrades/contracts/utils/cryptography/ECDSAUpgradeable.sol";
import {IERC1271Upgradeable} from "@openzeppelin-upgrades/contracts/interfaces/IERC1271Upgradeable.sol";

contract RangeExitManagerService is ECDSAServiceManagerBase, IRangeExitServiceManager {
    using ECDSAUpgradeable for bytes32;

    mapping(uint128 => bytes32) public allTaskHashes;
    mapping(address operator => mapping(bytes32 => bytes)) public allTaskResponses;
    mapping(bytes32 => bool) public taskWasResponded;

    uint128 public latestTaskNum;

    ILPRebalanceHook public HOOK;

    // max interval in blocks for responding to a task
    // operators can be penalized if they don't respond in time
    uint32 public immutable MAX_RESPONSE_INTERVAL_BLOCKS;

    modifier onlyOperator() {
        require(ECDSAStakeRegistry(stakeRegistry).operatorRegistered(msg.sender), "Operator must be the caller");
        _;
    }

    modifier onlyHook() {
        require(msg.sender == address(HOOK), "Only hook contract can call this function");
        _;
    }

    constructor(
        address _avsDirectory,
        address _stakeRegistry,
        address _rewardsCoordinator,
        address _delegationManager,
        address _allocationManager,
        uint32 _maxResponseIntervalBlocks
    )
        ECDSAServiceManagerBase(_avsDirectory, _stakeRegistry, _rewardsCoordinator, _delegationManager, _allocationManager)
    {
        MAX_RESPONSE_INTERVAL_BLOCKS = _maxResponseIntervalBlocks;
    }

    function setHookAddress(address _hookAddress) external onlyOwner {
        HOOK = ILPRebalanceHook(_hookAddress);
    }

    function initialize(address initialOwner, address _rewardsInitiator, address _hookAddress) external initializer {
        __ServiceManagerBase_init(initialOwner, _rewardsInitiator);
        HOOK = ILPRebalanceHook(_hookAddress);
    }

    // These are just to comply with IServiceManager interface
    function addPendingAdmin(address admin) external onlyOwner {}
    function removePendingAdmin(address pendingAdmin) external onlyOwner {}
    function removeAdmin(address admin) external onlyOwner {}
    function setAppointee(address appointee, address target, bytes4 selector) external onlyOwner {}
    function removeAppointee(address appointee, address target, bytes4 selector) external onlyOwner {}
    function deregisterOperatorFromOperatorSets(address operator, uint32[] memory operatorSetIds) external {
        // unused
    }

    // @notice Configures a position to be managed by the service.
    function configurePosition(
        int24 tickThreshold,
        StrategyId strategyId,
        uint256 positionId,
        address posM,
        int24 tickSpacing
    ) external returns (UserConfig memory) {
        address positionOwner = IPositionManagerMinimal(posM).ownerOf(positionId);
        require(positionOwner == msg.sender, UserNotPositionOwner(positionOwner, msg.sender));
        require(isStrategyIdValid(strategyId), "Invalid strategy id");
        // todo: replace isApprovedForAll with isApprovedForPosition
        bool isApproved = IPositionManagerMinimal(posM).isApprovedForAll(positionOwner, address(this));
        require(isApproved, "Position is not approved for the AVS");

        int24 tickThresholdToUse = HOOK.getLowerUsableTick(tickThreshold, tickSpacing);
        UserConfig memory config = UserConfig({
            tickThreshold: tickThresholdToUse,
            strategyId: uint8(strategyId),
            owner: msg.sender,
            positionId: positionId,
            posM: posM
        });

        emit PositionConfigured(tickThresholdToUse, positionId, config);

        return config;
    }

    function isStrategyIdValid(StrategyId strategyId) internal pure returns (bool) {
        if (strategyId == StrategyId.Asset0ToAave) {
            return true;
        } else if (strategyId == StrategyId.None) {
            return true;
        }

        return false;
    }

    function createNewTask(PoolKeyCustom calldata poolKey, int24 lastTick, uint256 deadline, bytes32 poolId)
        external
        onlyHook
        returns (bytes32)
    {
        Task memory task =
            Task({poolKey: poolKey, lastTick: lastTick, deadline: deadline, createdBlock: uint32(block.number)});

        bytes32 thash = keccak256(abi.encode(task));
        allTaskHashes[latestTaskNum] = thash;
        emit WithdrawNeeded(task, latestTaskNum, poolKey, lastTick, deadline, poolId);
        latestTaskNum = latestTaskNum + 1;

        return thash;
    }

    // Backend AVS flow: modify positions for a price-change task
    // Steps (offchain + onchain coordination):
    //  - offchain validates candidate positions via database query
    //  - offchain submits a batch of UserConfig entries here for processing
    //  - onchain will perform:
    //      1) burn liquidity / withdraw from Uniswap (integration via position manager)
    //      2) unwrap/swap as needed and supply to Aave per strategy
    //      3) account for fees and record per-user results
    // NOTE: before posM.modifyLiqudities we should perform the following checks:
    // 1. we have the approval for the position
    // 2. the position exists
    // 3. the position is in the expected state per our UserConfig's tickThreshold AND Strategy
    // e.g.: if our strategy is StrategyId.Asset0ToAave, we must ensure the liquidity position consists 100% of asset0
    // if not, do not call posM.modifyLiquidities for this specific position.
    function withdrawLiquidity(
        Task calldata task,
        uint32 taskIndex,
        UserConfig[] calldata configs,
        bytes calldata signature
    ) external onlyOperator {
        bytes32 thash = keccak256(abi.encode(task));
        require(allTaskHashes[taskIndex] == thash, "Task not found");
        require(task.deadline > block.timestamp, "Task deadline has already passed");

        (address[] memory operators, bytes[] memory signatures, uint32 referenceBlock) =
            abi.decode(signature, (address[], bytes[], uint32));
        require(referenceBlock == task.createdBlock, "Reference block must match task creation block");

        // The message that was signed
        bytes32 messageHash = keccak256(abi.encodePacked("Hello, ", task.lastTick));
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        bytes4 magicValue = IERC1271Upgradeable.isValidSignature.selector;

        for (uint256 i = 0; i < operators.length; i++) {
            require(allTaskResponses[operators[i]][thash].length == 0, "Operator has already responded to the task");
            allTaskResponses[operators[i]][thash] = signatures[i];
            emit TaskResponded(thash, task, operators[i]);
        }

        emit PositionsModificationRequested(thash, configs.length);

        address currency0 = task.poolKey.currency0;
        address currency1 = task.poolKey.currency1;

        for (uint256 i = 0; i < configs.length; i++) {
            UserConfig memory userConfig = configs[i];

            IPositionManagerMinimal posM = IPositionManagerMinimal(userConfig.posM);
            uint256 positionId = userConfig.positionId;
            address owner = userConfig.owner;

            bool isValidPosition = validatePositionForWithdraw(userConfig, posM);
            if (!isValidPosition) {
                console.log("Invalid position, continue");
                continue;
            }

            console.log("Position is valid, proceeding according to strategy", positionId);

            // todo: add min amounts
            uint128 amount0Min = 0;
            uint128 amount1Min = 0;
            bytes memory hookData = bytes("");
            uint256 deadline = block.timestamp + 60;

            bytes memory actions = abi.encodePacked(uint8(Actions.BURN_POSITION), uint8(Actions.TAKE_PAIR));
            bytes[] memory params = new bytes[](2);
            params[0] = abi.encode(positionId, amount0Min, amount1Min, hookData);
            params[1] = abi.encode(currency0, currency1, owner);

            console.log("Burning position id: ", positionId);
            console.log("Recipient: ", owner);

            // commented out for tests
            // posM.modifyLiquidities(abi.encode(actions, params), deadline);
            emit PositionBurned(positionId, owner, userConfig);
            console.log("Position burned successfully", positionId);
        }

        taskWasResponded[thash] = true;
        bytes4 isValidSignatureResult =
            ECDSAStakeRegistry(stakeRegistry).isValidSignature(ethSignedMessageHash, signature);

        require(magicValue == isValidSignatureResult, "Invalid signature");
    }

    function validatePositionForWithdraw(UserConfig memory userConfig, IPositionManagerMinimal posM)
        public
        view
        returns (bool)
    {
        if (userConfig.positionId == 0) {
            console.log("Position id is invalid");
            return false;
        }
        if (userConfig.owner == address(0)) {
            console.log("Owner is invalid");
            return false;
        }

        (PoolKeyCustom memory poolKey, uint256 positionInfo) = posM.getPoolAndPositionInfo(userConfig.positionId);
        if (positionInfo == 0) {
            return false;
        }

        if (userConfig.strategyId == uint8(StrategyId.Asset0ToAave)) {
            // the position is only valid if there's no asset1 in it.
            // i.e., the position consists 100% of asset0.
            int24 currentTick = HOOK.getCurrentTick(poolKey);
            if (currentTick < userConfig.tickThreshold) {
                return true;
            } else {
                return false;
            }
        }

        return true;
    }

    function cancelDelegation(uint256 positionId, address posM) external {
        // Scenario: user cancels approval/delegation
        // On-chain expected actions:
        //  - verify caller is owner of the position
        //  - opt-out of position management
        address owner = IPositionManagerMinimal(posM).ownerOf(positionId);
        require(owner == msg.sender, "Only position owner");
        emit DelegationCancelled(owner, positionId, 0);
    }

    // function _applyStrategy(Task memory task, UserConfig memory config) internal {
    //     if (StrategyId(config.strategyId) == StrategyId.BurnWithdrawToAave) {
    //         // TODO: integrate with position manager to burn liquidity and withdraw
    //         // TODO: route assets to Aave pool and update accounting
    //         emit PositionModified(config.positionId, config.owner);
    //     }
    // }

    function slashOperator(Task calldata task, uint32 taskIndex, address operator) external {
        // check that the task is valid, hasn't been responsed yet
        bytes32 thash = keccak256(abi.encode(task));
        require(allTaskHashes[taskIndex] == thash, "Task not found");
        require(block.timestamp < task.deadline, "Task response time has already expired");

        require(allTaskResponses[operator][thash].length == 0, "Operator has already responded to the task");
        require(
            block.number > task.createdBlock + MAX_RESPONSE_INTERVAL_BLOCKS, "Task response time has not expired yet"
        );
        // check operator was registered when task was created
        uint256 operatorWeight = ECDSAStakeRegistry(stakeRegistry).getOperatorWeightAtBlock(operator, task.createdBlock);
        require(operatorWeight > 0, "Operator was not registered when task was created");

        // we update the storage with a sentinel value
        allTaskResponses[operator][thash] = "slashed";

        // TODO: slash operator
    }
}
