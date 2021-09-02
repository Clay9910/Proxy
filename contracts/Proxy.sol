// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Proxy is Ownable {
    using SafeERC20 for IERC20;

    struct DepositInfo{
        uint amount; //需要跨链的数额
        uint reward; //给relayer奖励的数额
        uint deadline; //过期时间，  用户存入默认deadline为blocktime+period，relayer锁定后deadline再加两个period。
        uint nonce; //存入时整个合约的序列

        uint chainIDFrom;
        uint chainIDTo;

        address relayer;
        address depositer;
    }

    struct HarvestInfo{
        address asset;
        uint amount;
        uint deadline;
        uint nonce; //这个字段存入的是源链中deposit的nonce，由relayer汇报给目标链合约
    }

    mapping(address => uint) public nonces;

    uint public period = 1 hours;
    uint public periodDouble = 2 hours;

    uint public chainID;

    string public constant name = 'Proxy';
    // keccak256("harvest(address asset, address usr, uint amount, uint nonce)");
    bytes32 public constant HARVEST_TYPEHASH = 0x6d0ee39968261b1f87053b0d5ebf68b720a9891a612c6ef260a27d1e54f0e097;

    mapping(address => bool) private relayerWhiteList;

    mapping(address => bool) private assetWhiteList;

    mapping(address => mapping(uint => mapping(address => DepositInfo))) private userDepositInfos; // user(chainid=>(asset=>DepositInfo))

    mapping(address => mapping(uint => mapping(address => HarvestInfo))) private userHarvestInfos; // user(chainid=>(asset=>DepositInfo))

    mapping(uint => bytes32) private DOMAIN_SEPARATORS;

    event SetRelayerWhiteList(address indexed relayer, bool state);

    event SeAssetWhiteList(address indexed asset, bool state);

    event Deposit(address indexed user, address indexed asset, uint amount, uint reward, uint nonce, uint deadline, uint chainID, uint chainIDTo);

    event Withdraw(address indexed user, address indexed asset, uint amount, uint reward, uint nonce);

    event Lock(address indexed user, address indexed asset, address indexed relayer, uint deadline);

    event DepositForRelayer(address indexed user, address indexed asset, uint amount, uint deadline, uint chainIDFrom);

    event HarvestForRealyer(address user, address asset, uint amount, uint reward, uint chainIDTo);
    
    event Harvest(address user, address asset, uint chainIDFrom, uint chainIDTo,uint8 v, bytes32 r, bytes32 s);

    constructor(){
        chainID = block.chainid;
    }

    modifier onlyRealyerWhiteList(){
        require(relayerWhiteList[msg.sender] == true, "caller is not in the whiteList");
        _;
    }

    modifier onlyAssetWhiteList(address asset){
        require(assetWhiteList[asset] == true, "asset is not in the whiteList");
        _;
    }

    function isRelayerInWhiteList(address relayer) view external returns(bool){
        return relayerWhiteList[relayer];
    }

    function isAssetInWhiteList(address asset) view external returns(bool){
        return assetWhiteList[asset];
    }

    function getDepositInfoCurrent(address user, address asset, uint chainIDTo) view external returns(uint, uint, uint, uint, address, address){
        DepositInfo memory info = userDepositInfos[user][chainIDTo][asset];
        return (info.amount, info.reward, info.nonce, info.deadline, info.depositer, info.relayer);
    }

    function getHarvestInfoCurrent(address user, address asset, uint chainIDFrom) view external returns(uint, uint, uint){
        HarvestInfo memory info = userHarvestInfos[user][chainIDFrom][asset];
        return (info.amount, info.nonce, info.deadline);
    }

    function getDomainSeparator(uint _chainID) external view returns(bytes32){
        return DOMAIN_SEPARATORS[_chainID];
    }

    //设置允许跨链的DOMAIN_SEPARATOR信息
    function setDomainSeparator(uint _chainID) external onlyOwner{
        bytes32 DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'),
                keccak256(bytes(name)),
                keccak256(bytes('1')),
                _chainID,
                address(this)
            )
        );
        DOMAIN_SEPARATORS[_chainID] = DOMAIN_SEPARATOR;
    }

    //设置资产白名单
    function setAssetWhiteList(address asset, bool state) external onlyOwner{
        assetWhiteList[asset] = state;
        emit SeAssetWhiteList(asset, state);
    }

    //设置relayer白名单
    function setRelayerWhiteList(address relayer, bool state) external onlyOwner {
        relayerWhiteList[relayer] = state;
        emit SetRelayerWhiteList(relayer, state);
    }

    //用户入金，源链接口
    function deposit(IERC20 asset, uint amount, uint reward, uint chainIDTo) external onlyAssetWhiteList(address(asset)){
        DepositInfo storage info = userDepositInfos[msg.sender][chainIDTo][address(asset)];
        require(amount > 0, "Params error");
        require(chainIDTo != chainID , "ChainID wrong");
        require(info.amount == 0, "There is already a transaction being processed");
        asset.safeTransferFrom(msg.sender, address(this), amount + reward);
        info.amount = amount;
        info.reward = reward;
        info.deadline = block.timestamp + period;
        info.nonce = nonces[msg.sender]++;
        info.chainIDTo = chainIDTo;
        info.chainIDFrom = chainID;
        info.depositer = msg.sender;
        emit Deposit(msg.sender, address(asset), amount, reward, nonces[msg.sender], info.deadline, chainID, chainIDTo); 
    }

    //超时用户取回钱，源链接口
    function withdraw(IERC20 asset, uint chainIDTo) external{
        DepositInfo storage info = userDepositInfos[msg.sender][chainIDTo][address(asset)];
        require(info.amount != 0, "Info error");
        require(block.timestamp > info.deadline , "Hasn't timed out");
        asset.safeTransfer(msg.sender, info.amount + info.reward);
        emit Withdraw(msg.sender, address(asset), info.amount, info.reward, info.nonce); 
        delete userDepositInfos[msg.sender][chainIDTo][address(asset)];
    }

    //relayer同步信息，锁定某一笔用户跨链的信息，表示该relayer正在处理。源链接口
    function lock(IERC20 asset, address user, uint chainIDTo) external onlyRealyerWhiteList {
        DepositInfo storage info = userDepositInfos[user][chainIDTo][address(asset)];
        require(info.depositer != address(0), "Info doesn't exist");
        require(info.relayer == address(0), "Has been locked");
        require(block.timestamp < info.deadline, "Expired");
        info.relayer = msg.sender;
        info.deadline = info.deadline + periodDouble;
        emit Lock(user, address(asset), msg.sender, info.deadline);
    }

    //relayer 入金，deadline由relayer来确定，一般为源链暴露出来的deadline时间减去一个period，目标链接口。
    function depositForRelayer(IERC20 asset, address user, uint amount, uint nonce, uint chainIDFrom, uint chainIDTo, uint deadline) external onlyRealyerWhiteList onlyAssetWhiteList(address(asset)){
        require(chainIDTo == chainID, "ChainID wrong");
        address relayer = msg.sender;
        HarvestInfo storage info = userHarvestInfos[user][chainIDFrom][address(asset)];
        require(info.amount == 0, "Info doesn't exist");
        require(block.timestamp < deadline, "Expired");
        asset.safeTransferFrom(relayer, address(this), amount);
        info.amount = amount;
        info.asset = address(asset);
        info.deadline = deadline;
        info.nonce = nonce;
        emit DepositForRelayer(user, info.asset, info.amount, info.deadline, info.nonce);
    }

    //用户提取目标链上的资产，需要提交自己的签名. 目标链接口
    function harvest(IERC20 asset, uint chainIDFrom, uint8 v, bytes32 r, bytes32 s) external {
        HarvestInfo storage info = userHarvestInfos[msg.sender][chainIDFrom][address(asset)];
        require(info.amount != 0, "Info doesn't exist");
        require(block.timestamp < info.deadline, 'Expired');
        bytes32 DOMAIN_SEPARATOR = DOMAIN_SEPARATORS[chainIDFrom];
        require(DOMAIN_SEPARATOR != bytes32(0), "Should setDomainSeparator First");
        bytes32 digest = keccak256(
            abi.encodePacked(
                '\x19\x01',
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(HARVEST_TYPEHASH, info.asset, msg.sender, info.amount, info.nonce))
            )
        );
        address signer = ecrecover(digest, v, r, s);
        require(signer == msg.sender, "Invalid signature");
        asset.safeTransfer(msg.sender, info.amount);
        emit Harvest(msg.sender, address(asset), chainIDFrom, chainID, v, r, s);
        delete userHarvestInfos[msg.sender][chainIDFrom][address(asset)];
    }

    //relayer提取源链上的资产，使用用户的vsr数据， 源链接口
    function harvestForRealyer(IERC20 asset, address usr, uint chainIDTo, uint8 v, bytes32 r, bytes32 s) external onlyRealyerWhiteList {
        DepositInfo storage info = userDepositInfos[usr][chainIDTo][address(asset)];
        // require(block.timestamp < info.deadline, 'Expired');
        require(info.relayer == msg.sender, "Wrong address");
        bytes32 DOMAIN_SEPARATOR = DOMAIN_SEPARATORS[info.chainIDFrom];
        require(DOMAIN_SEPARATOR != bytes32(0), "Should setDomainSeparator First");
        bytes32 digest = keccak256(
            abi.encodePacked(
                '\x19\x01',
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(HARVEST_TYPEHASH, asset, info.depositer, info.amount, info.nonce))
            )
        );
        address signer = ecrecover(digest, v, r, s);
        require(signer == info.depositer, "Invalid signature");
        asset.safeTransfer(msg.sender, info.amount + info.reward);
        emit HarvestForRealyer(usr, address(asset), info.amount, info.reward, chainIDTo);
        delete userDepositInfos[usr][chainIDTo][address(asset)];
    }

}
