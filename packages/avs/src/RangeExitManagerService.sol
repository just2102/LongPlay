// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {ECDSAServiceManagerBase} from "eigenlayer-middleware/src/unaudited/ECDSAServiceManagerBase.sol";
import {ECDSAStakeRegistry} from "eigenlayer-middleware/src/unaudited/ECDSAStakeRegistry.sol";
import {console} from "forge-std/console.sol";

import {IRangeExitServiceManager} from "./interfaces/IRangeExitServiceManager.sol";
import {IPositionManagerMinimal} from "./interfaces/IPositionManagerMinimal.sol";
import {ILPRebalanceHook} from "./interfaces/ILPRebalanceHook.sol";
import {IPool} from "./interfaces/IAavePool.sol";
import {Actions} from "./libraries/Actions.sol";
import {DataTypes} from "./libraries/AaveDataTypes.sol";

import {ECDSAUpgradeable} from "@openzeppelin-upgrades/contracts/utils/cryptography/ECDSAUpgradeable.sol";
import {IERC1271Upgradeable} from "@openzeppelin-upgrades/contracts/interfaces/IERC1271Upgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract RangeExitManagerService is ECDSAServiceManagerBase, IRangeExitServiceManager {
    using ECDSAUpgradeable for bytes32;

    mapping(uint128 => bytes32) public allTaskHashes;
    mapping(address operator => mapping(bytes32 => bytes)) public allTaskResponses;
    mapping(bytes32 => bool) public taskWasResponded;
    mapping(uint256 => bool) public isPositionManaged;
    mapping(uint256 => UserConfig) public userConfigs;
    mapping(uint256 => bool) public isPositionWithdrawn;
    mapping(uint256 => bool) public isPositionSupplied;

    uint128 public latestTaskNum;
    uint256 public SERVICE_FEE;

    ILPRebalanceHook public HOOK;
    IPool public AAVE_POOL;

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

    function setPoolAddress(address _poolAddress) external onlyOwner {
        AAVE_POOL = IPool(_poolAddress);
    }

    function setServiceFee(uint256 _serviceFee) external onlyOwner {
        SERVICE_FEE = _serviceFee;
    }

    function initialize(address initialOwner, address _rewardsInitiator, address _hookAddress, address _aavePoolAddress)
        external
        initializer
    {
        __ServiceManagerBase_init(initialOwner, _rewardsInitiator);
        HOOK = ILPRebalanceHook(_hookAddress);
        AAVE_POOL = IPool(_aavePoolAddress);
        SERVICE_FEE = 0.0001 ether;
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
        int24 tickSpacing,
        address currency0,
        address currency1
    ) external payable returns (UserConfig memory) {
        require(msg.value >= SERVICE_FEE, "Insufficient service fee");
        address positionOwner = IPositionManagerMinimal(posM).ownerOf(positionId);
        require(positionOwner == msg.sender, UserNotPositionOwner(positionOwner, msg.sender));
        require(isStrategyValid(strategyId, currency0, currency1), "Invalid strategy or currencies");
        // todo: replace isApprovedForAll with isApprovedForPosition
        bool isApproved = IPositionManagerMinimal(posM).isApprovedForAll(positionOwner, address(this));
        require(isApproved, "Position is not approved for the AVS");

        int24 tickThresholdToUse = HOOK.getUsableTick(tickThreshold, tickSpacing);
        UserConfig memory config = UserConfig({
            tickThreshold: tickThresholdToUse,
            strategyId: uint8(strategyId),
            owner: msg.sender,
            positionId: positionId,
            posM: posM
        });

        userConfigs[positionId] = config;
        isPositionManaged[positionId] = true;
        emit PositionConfigured(tickThresholdToUse, positionId, config);

        return config;
    }

    function isStrategyValid(StrategyId strategyId, address currency0, address currency1) public view returns (bool) {
        if (strategyId == StrategyId.Asset0ToAave) {
            return isCurrencySuppliableAave(currency0);
        } else if (strategyId == StrategyId.None) {
            return false;
        } else if (strategyId == StrategyId.Asset1ToAave) {
            return isCurrencySuppliableAave(currency1);
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

        taskWasResponded[thash] = true;
        bytes4 isValidSignatureResult =
            ECDSAStakeRegistry(stakeRegistry).isValidSignature(ethSignedMessageHash, signature);
        require(magicValue == isValidSignatureResult, "Invalid signature");

        emit PositionsModificationRequested(thash, configs.length);

        address currency0 = task.poolKey.currency0;
        address currency1 = task.poolKey.currency1;

        if (configs.length > 0) {
            for (uint256 i = 0; i < configs.length; i++) {
                UserConfig memory userConfig = configs[i];

                IPositionManagerMinimal posM = IPositionManagerMinimal(userConfig.posM);
                uint256 positionId = userConfig.positionId;
                address owner = userConfig.owner;

                bool isValidPosition = validatePositionForWithdraw(userConfig, posM);
                if (!isValidPosition) {
                    continue;
                }

                (uint256 b0Before, uint256 b1Before) = getBalancesOfTwoCurrencies(currency0, currency1);
                // todo: add min amounts
                uint128 amount0Min = 0;
                uint128 amount1Min = 0;
                bytes memory hookData = bytes("");
                uint256 deadline = block.timestamp + 60;

                bytes memory actions = abi.encodePacked(uint8(Actions.BURN_POSITION), uint8(Actions.TAKE_PAIR));
                bytes[] memory params = new bytes[](2);
                params[0] = abi.encode(positionId, amount0Min, amount1Min, hookData);
                params[1] = abi.encode(currency0, currency1, address(this));

                isPositionWithdrawn[positionId] = true;
                posM.modifyLiquidities(abi.encode(actions, params), deadline);
                applyStrategy(userConfig, currency0, currency1, b0Before, b1Before);
                emit PositionBurned(positionId, owner, userConfig);
            }
        }
    }

    function getBalancesOfTwoCurrencies(address currency0, address currency1)
        internal
        view
        returns (uint256, uint256)
    {
        uint256 b0;
        uint256 b1;

        if (currency0 == address(0)) {
            b0 = address(this).balance;
        } else {
            b0 = IERC20(currency0).balanceOf(address(this));
        }

        if (currency1 == address(0)) {
            b1 = address(this).balance;
        } else {
            b1 = IERC20(currency1).balanceOf(address(this));
        }

        return (b0, b1);
    }

    function validatePositionForWithdraw(UserConfig memory userConfig, IPositionManagerMinimal posM)
        public
        view
        returns (bool)
    {
        if (userConfig.positionId == 0) {
            return false;
        }
        if (userConfig.owner == address(0)) {
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

        if (userConfig.strategyId == uint8(StrategyId.Asset1ToAave)) {
            int24 currentTick = HOOK.getCurrentTick(poolKey);
            if (currentTick > userConfig.tickThreshold) {
                return true;
            } else {
                return false;
            }
        }

        return true;
    }

    function cancelDelegation(uint256 positionId, address posM) external {
        address owner = IPositionManagerMinimal(posM).ownerOf(positionId);
        require(owner == msg.sender, "Only position owner");
        emit DelegationCancelled(owner, positionId, 0);
        isPositionManaged[positionId] = false;
        userConfigs[positionId] = UserConfig({
            tickThreshold: 0,
            strategyId: uint8(StrategyId.None),
            owner: address(0),
            positionId: 0,
            posM: address(0)
        });
    }

    function setPositionManaged(uint256 positionId, bool managed) external onlyOperator {
        isPositionManaged[positionId] = managed;
    }

    function applyStrategy(
        UserConfig memory userConfig,
        address currency0,
        address currency1,
        uint256 b0Before,
        uint256 b1Before
    ) internal {
        (uint256 b0Now, uint256 b1Now) = getBalancesOfTwoCurrencies(currency0, currency1);
        uint256 r0 = b0Now - b0Before;
        uint256 r1 = b1Now - b1Before;

        address owner = userConfig.owner;
        IERC20 t0 = IERC20(currency0);
        IERC20 t1 = IERC20(currency1);

        if (userConfig.strategyId == uint8(StrategyId.Asset0ToAave) && r0 > 0) {
            t0.approve(address(AAVE_POOL), type(uint256).max);
            try AAVE_POOL.supply(currency0, r0, owner, 0) {
                emit SupplySuccess(currency0, r0, owner);
                isPositionSupplied[userConfig.positionId] = true;
            } catch {
                emit SupplyFailed(currency0, r0, owner);
            }
            if (r1 > 0) t1.transfer(owner, r1);
        } else if (userConfig.strategyId == uint8(StrategyId.Asset1ToAave) && r1 > 0) {
            t1.approve(address(AAVE_POOL), type(uint256).max);
            try AAVE_POOL.supply(currency1, r1, owner, 0) {
                emit SupplySuccess(currency1, r1, owner);
                isPositionSupplied[userConfig.positionId] = true;
            } catch {
                emit SupplyFailed(currency1, r1, owner);
            }
            if (r0 > 0) t0.transfer(owner, r0);
        } else {
            return sendTokensToOwner(r0, r1, t0, t1, owner);
        }
    }

    function isCurrencySuppliableAave(address currency) public view returns (bool) {
        DataTypes.ReserveConfigurationMap memory reserveConfig = AAVE_POOL.getConfiguration(currency);

        bool active = ((reserveConfig.data >> 56) & 1) == 1;
        bool frozen = ((reserveConfig.data >> 57) & 1) == 1;
        bool paused = ((reserveConfig.data >> 60) & 1) == 1;
        if (!active || frozen || paused) return false;

        return reserveConfig.data != 0;
    }

    function sendTokensToOwner(uint256 r0, uint256 r1, IERC20 t0, IERC20 t1, address owner) internal {
        if (r0 > 0) t0.transfer(owner, r0);
        if (r1 > 0) t1.transfer(owner, r1);
    }

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
