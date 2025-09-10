// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {ECDSAServiceManagerBase} from "eigenlayer-middleware/src/unaudited/ECDSAServiceManagerBase.sol";
import {ECDSAStakeRegistry} from "eigenlayer-middleware/src/unaudited/ECDSAStakeRegistry.sol";

import {IRangeExitServiceManager} from "./interfaces/IRangeExitServiceManager.sol";
import {IPositionManagerMinimal} from "./interfaces/IPositionManagerMinimal.sol";

contract RangeExitManagerService is ECDSAServiceManagerBase, IRangeExitServiceManager {
    mapping(bytes32 => Task) public tasks;
    mapping(address operator => mapping(bytes32 => bytes)) public allTaskResponses;
    mapping(bytes32 => bool) public taskWasResponded;

    // max interval in blocks for responding to a task
    // operators can be penalized if they don't respond in time
    uint32 public immutable MAX_RESPONSE_INTERVAL_BLOCKS;

    modifier onlyOperator() {
        require(ECDSAStakeRegistry(stakeRegistry).operatorRegistered(msg.sender), "Operator must be the caller");
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

    function initialize(address initialOwner, address _rewardsInitiator) external initializer {
        __ServiceManagerBase_init(initialOwner, _rewardsInitiator);
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
    function configurePosition(int24 tickThreshold, StrategyId strategyId, uint256 positionId, address posM)
        external
        view
        returns (UserConfig memory)
    {
        address positionOwner = IPositionManagerMinimal(posM).ownerOf(positionId);
        require(positionOwner == msg.sender, "User does not own the position");
        require(isStrategyIdValid(strategyId), "Invalid strategy id");
        bool isApproved = IPositionManagerMinimal(posM).isApprovedForAll(positionOwner, address(this));
        require(isApproved, "Position is not approved for the AVS");

        UserConfig memory config = UserConfig({
            tickThreshold: tickThreshold,
            strategyId: uint8(strategyId),
            owner: msg.sender,
            positionId: positionId,
            posM: posM
        });

        return config;
    }

    function isStrategyIdValid(StrategyId strategyId) internal pure returns (bool) {
        if (strategyId == StrategyId.BurnWithdrawToAave) {
            return true;
        } else if (strategyId == StrategyId.None) {
            return true;
        }

        return false;
    }

    // todo: only hook contract should be able to create tasks
    function createNewTask(PoolKeyCustom calldata poolKey, int24 lastTick, uint256 deadline)
        external
        returns (bytes32)
    {
        Task memory t =
            Task({poolKey: poolKey, lastTick: lastTick, deadline: deadline, createdBlock: uint32(block.number)});

        bytes32 thash = keccak256(abi.encode(t));
        tasks[thash] = t;
        emit WithdrawNeeded(poolKey, lastTick, deadline);

        return thash;
    }

    function respondToTask(Task calldata task, bytes calldata signature) external {
        bytes32 thash = keccak256(abi.encode(task));
        require(tasks[thash].lastTick != 0, "Task not found");

        require(block.timestamp < task.deadline, "Task response time has already expired");

        // Decode the signature data to get operators and their signatures
        (address[] memory operators, bytes[] memory signatures, uint32 referenceBlock) =
            abi.decode(signature, (address[], bytes[], uint32));
        // Check that referenceBlock matches task creation block
        require(referenceBlock == task.createdBlock, "Reference block must match task creation block");

        // Store each operator's signature
        for (uint256 i = 0; i < operators.length; i++) {
            // Check that this operator hasn't already responded
            require(allTaskResponses[operators[i]][thash].length == 0, "Operator has already responded to the task");

            // Store the operator's signature
            allTaskResponses[operators[i]][thash] = signatures[i];

            // Emit event for this operator
            emit TaskResponded(thash, task, operators[i]);
        }

        taskWasResponded[thash] = true;

        // todo: verify the task was executed as expected
        // bytes4 isValidSignatureResult =
        //     ECDSAStakeRegistry(stakeRegistry).isValidSignature(ethSignedMessageHash, signature);

        // require(magicValue == isValidSignatureResult, "Invalid signature");
    }

    function slashOperator(Task calldata task, address operator) external {
        // check that the task is valid, hasn't been responsed yet
        bytes32 thash = keccak256(abi.encode(task));
        require(tasks[thash].lastTick != 0, "Task not found");
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
