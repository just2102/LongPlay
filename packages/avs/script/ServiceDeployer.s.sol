// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/Test.sol";
import {DeploymentLib} from "./DeploymentLib.sol";
import {CoreDeployLib, CoreDeploymentParsingLib} from "./CoreDeploymentParsingLib.sol";
import {UpgradeableProxyLib} from "./UpgradeableProxyLib.sol";
import {StrategyBase} from "@eigenlayer/contracts/strategies/StrategyBase.sol";
import {ERC20Mock} from "eigenlayer-middleware/test/mocks/ERC20Mock.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {StrategyFactory} from "@eigenlayer/contracts/strategies/StrategyFactory.sol";
import {StrategyManager} from "@eigenlayer/contracts/core/StrategyManager.sol";
import {IRewardsCoordinator} from "@eigenlayer/contracts/interfaces/IRewardsCoordinator.sol";

import {IECDSAStakeRegistryTypes, IStrategy} from "eigenlayer-middleware/src/interfaces/IECDSAStakeRegistry.sol";

import "forge-std/Test.sol";

contract ServiceDeployer is Script, Test {
    using CoreDeployLib for *;
    using UpgradeableProxyLib for address;

    address private deployer;
    address proxyAdmin;
    address rewardsOwner;
    address rewardsInitiator;
    IStrategy serviceStrategy;
    CoreDeployLib.DeploymentData coreDeployment;
    DeploymentLib.DeploymentData serviceDeployment;
    DeploymentLib.DeploymentConfigData serviceConfig;
    IECDSAStakeRegistryTypes.Quorum internal quorum;
    ERC20Mock token;

    function setUp() public virtual {
        deployer = vm.rememberKey(vm.envUint("PRIVATE_KEY"));
        vm.label(deployer, "Deployer");

        serviceConfig = DeploymentLib.readDeploymentConfigValues("config/service/", block.chainid);

        coreDeployment = CoreDeploymentParsingLib.readDeploymentJson("deployments/core/", block.chainid);
    }

    function run() external {
        vm.startBroadcast(deployer);
        rewardsOwner = serviceConfig.rewardsOwner;
        rewardsInitiator = serviceConfig.rewardsInitiator;

        token = new ERC20Mock();
        // NOTE: if this fails, it's because the initialStrategyWhitelister is not set to be the StrategyFactory
        serviceStrategy = IStrategy(StrategyFactory(coreDeployment.strategyFactory).deployNewStrategy(token));

        quorum.strategies.push(IECDSAStakeRegistryTypes.StrategyParams({strategy: serviceStrategy, multiplier: 10_000}));

        token.mint(deployer, 2000);
        token.increaseAllowance(address(coreDeployment.strategyManager), 1000);
        StrategyManager(coreDeployment.strategyManager).depositIntoStrategy(serviceStrategy, token, 1000);

        proxyAdmin = UpgradeableProxyLib.deployProxyAdmin();

        serviceDeployment =
            DeploymentLib.deployContracts(proxyAdmin, coreDeployment, quorum, rewardsInitiator, rewardsOwner);

        serviceDeployment.strategy = address(serviceStrategy);
        serviceDeployment.token = address(token);

        vm.stopBroadcast();
        verifyDeployment();
        DeploymentLib.writeDeploymentJson(serviceDeployment);
    }

    function verifyDeployment() internal view {
        require(serviceDeployment.stakeRegistry != address(0), "StakeRegistry address cannot be zero");
        require(serviceDeployment.service != address(0), "Service address cannot be zero");
        require(serviceDeployment.strategy != address(0), "Strategy address cannot be zero");
        require(proxyAdmin != address(0), "ProxyAdmin address cannot be zero");
        require(coreDeployment.delegationManager != address(0), "DelegationManager address cannot be zero");
        require(coreDeployment.avsDirectory != address(0), "AVSDirectory address cannot be zero");
    }
}
