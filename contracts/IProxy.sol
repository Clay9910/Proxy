// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;


//for test
interface IProxy {
    function nonces(address user) external view returns(uint);
    function chainID() external view returns(uint);

    function isRelayerInWhiteList(address relayer) view external returns(bool);
    function isAssetInWhiteList(address asset) view external returns(bool);
    function getDepositInfoCurrent(address user, address asset, uint chainIDTo) view external returns(uint, uint, uint, address, address);
    function getHarvestInfoCurrent(address user, address asset, uint chainIDFrom) view external returns(uint, uint, uint);
    function getDomainSeparator(uint _chainID) view external returns(bytes32);
    function setDomainSeparator(uint _chainID) external;
    function setAssetWhiteList(address asset, bool state) external;
    function setRelayerWhiteList(address relayer, bool state) external;
    function deposit(address asset, uint amount, uint reward, uint chainIDTo) external;
    function withdraw(address asset, uint chainIDTo) external;
    function lock(address asset, address user, uint chainIDTo) external;
    function depositForRelayer(address asset, address user, uint amount, uint nonce, uint chainIDFrom, uint chainIDTo, uint deadline)  external;
    function harvest(address asset, uint chainIDFrom, uint8 v, bytes32 r, bytes32 s) external;
    function harvestForRealyer(address asset, address usr, uint chainIDTo, uint8 v, bytes32 r, bytes32 s) external;
}