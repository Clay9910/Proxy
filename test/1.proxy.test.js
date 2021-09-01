const fs = require('fs');
const Proxy = artifacts.require("Proxy");
const TetherToken = artifacts.require("TetherToken");
const utils = require("ethers").utils;
const ecsign = require('ethereumjs-util').ecsign; 
const hdkey = require('ethereumjs-wallet').hdkey;
const bip39 = require("bip39");
const util = require('ethereumjs-util');
const mnemonic = fs.readFileSync(".secret").toString().trim();

const seedBuffer = bip39.mnemonicToSeedSync(mnemonic);
const key = hdkey.fromMasterSeed(seedBuffer).derivePath("m/44'/60'/0'/0/0");
const priKey = util.bufferToHex(key.getWallet().privateKey);

const rinkebyChainID = 4;
const mumbaiChainID = 80001;
const amount = 90000;
const reward = 10000;


contract("Proxy",async (accounts)=>{
    let deployed = JSON.parse(
        fs.readFileSync(`${process.cwd()}/test/deployed.json`).toString()
    )
    let USDT_RINKEBY = deployed.rinkeby.USDT;
    let USDT_MUMBAI = deployed.mumbai.USDT;

    
    let admin = accounts[0];
    let user = accounts[1];
    let relayer = accounts[2];


    it("should chainID is right", async ()=>{
        let proxyIns = await Proxy.deployed();
        let chainID = await proxyIns.chainID();
        console.log(`chainID:${chainID.toNumber()}`);
    });

    it("should owner is right", async ()=>{
        let proxyIns = await Proxy.deployed();
        let owner = await proxyIns.owner();
        assert.equal(owner, admin);
    });

    it("should add assetWhiteList success", async ()=>{
        let proxyIns = await Proxy.deployed();
        await proxyIns.setAssetWhiteList(USDT_RINKEBY, true);
        let exist = await proxyIns.isAssetInWhiteList(USDT_RINKEBY);
        assert.equal(exist, true);
    });

    it("should add relayerWhiteList success", async ()=>{
        let proxyIns = await Proxy.deployed();
        await proxyIns.setRelayerWhiteList(relayer, true);
        let exist = await proxyIns.isRelayerInWhiteList(relayer);
        assert.equal(exist, true);

        exist = await proxyIns.isRelayerInWhiteList(admin);
        assert.equal(exist, false);
    })

    it("should set setDomainSeparator success", async ()=>{
        let proxyIns = await Proxy.deployed();
        await proxyIns.setDomainSeparator(rinkebyChainID);
        let domainSeparator = await proxyIns.getDomainSeparator(rinkebyChainID);
        let _domainSeparator = utils.keccak256(
            utils.defaultAbiCoder.encode(
              ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
              [
                utils.keccak256(
                    utils.toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
                ),
                utils.keccak256(utils.toUtf8Bytes("Proxy")),
                utils.keccak256(utils.toUtf8Bytes('1')),
                rinkebyChainID,
                proxyIns.address
              ]
            )
        );
        assert.equal(_domainSeparator, domainSeparator);
    })

    it("should deposit success", async ()=>{

        let proxyIns = await Proxy.deployed();
        let tetherTokenIns = await TetherToken.at(USDT_RINKEBY);
        //先approve
        await tetherTokenIns.approve(proxyIns.address, amount + reward);
        let allowance = await tetherTokenIns.allowance(admin, proxyIns.address);
        //然后再deposit
        await proxyIns.deposit(tetherTokenIns.address, amount, reward, mumbaiChainID);
        let info = await proxyIns.getDepositInfoCurrent(admin, tetherTokenIns.address, mumbaiChainID);
        assert.equal(info[0].toNumber(), amount);
        assert.equal(info[1].toNumber(), reward);
    })

    ///ps:测试这个接口，需要修改withdraw中对于超时的判断
    // it("should withdraw success", async ()=>{
    //     let proxyIns = await Proxy.deployed();
    //     let tetherTokenIns = await TetherToken.at(USDT_RINKEBY);
    //     //withdraw之前usdt的数量
    //     let balanceOfOld = await tetherTokenIns.balanceOf(admin);
    //     await proxyIns.withdraw(USDT_RINKEBY, mumbaiChainID);
    //     //withdraw之前usdt的数量
    //     let balanceOfNew = await tetherTokenIns.balanceOf(admin);
    //     //现在proxy合约中的info应该为0
    //     let info = await proxyIns.getDepositInfoCurrent(admin, tetherTokenIns.address, mumbaiChainID);

    //     assert.equal(balanceOfNew - balanceOfOld, amount + reward);
    //     assert.equal(info[0].toNumber(), 0);
    // })

    ///如果上面测试了withdraw，那么需要重走deposit逻辑
    it("should lock success", async ()=>{
        let proxyIns = await Proxy.deployed();
        // let tetherTokenIns = await TetherToken.at(USDT_RINKEBY);
        // //先approve
        // await tetherTokenIns.approve(proxyIns.address, amount + reward);
        // //然后再deposit
        // await proxyIns.deposit(tetherTokenIns.address, amount, reward, mumbaiChainID);
        //再让relayer去lock
        await proxyIns.lock(USDT_RINKEBY, admin, mumbaiChainID, {from: relayer});
        let info = await proxyIns.getDepositInfoCurrent(admin, USDT_RINKEBY, mumbaiChainID);
        assert.equal(info[5], relayer);
    })

    ///relayer搬运，在目标链上给用户存入钱。
    ///mumbai =》 rinkeby
    it("should depositForRelayer success", async ()=>{
        let proxyIns = await Proxy.deployed();
        let tetherTokenIns = await TetherToken.at(USDT_RINKEBY);
        //先approve
        await tetherTokenIns.approve(proxyIns.address, amount, {from: relayer});
        
        await proxyIns.depositForRelayer(USDT_RINKEBY, admin, amount, 1, mumbaiChainID, rinkebyChainID, 1730404195, {from: relayer});
        let info = await proxyIns.getHarvestInfoCurrent(admin, USDT_RINKEBY, mumbaiChainID);
        assert.equal(info[0].toNumber(), amount);
    })

    /// 用户提取relayer存入目标链中的钱
    /// mumbai =》 rinkeby， mumbai为源链，用户在mumbai端抵押（无需实现），relayer搬运，用户从rinkeby端提取钱
    it("should harvest success", async ()=>{
        let proxyIns = await Proxy.deployed();

        //先增加mumbaiChainID的DomainSeparator
        await proxyIns.setDomainSeparator(mumbaiChainID);
        let info = await proxyIns.getHarvestInfoCurrent(admin, USDT_RINKEBY, mumbaiChainID);
        let DOMAIN_SEPARATOR = utils.keccak256(
            utils.defaultAbiCoder.encode(
              ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
              [
                utils.keccak256(
                    utils.toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
                ),
                utils.keccak256(utils.toUtf8Bytes("Proxy")),
                utils.keccak256(utils.toUtf8Bytes('1')),
                mumbaiChainID,
                proxyIns.address
              ]
            )
        );
        let PERMIT_TYPEHASH = await proxyIns.HARVEST_TYPEHASH();
        let digest = utils.keccak256(
            utils.solidityPack(
                ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
                [
                    '0x19',
                    '0x01',
                    DOMAIN_SEPARATOR,
                    utils.keccak256(
                        utils.defaultAbiCoder.encode(
                            ['bytes32', 'address', 'address', 'uint', 'uint'],
                            [PERMIT_TYPEHASH, USDT_RINKEBY, admin, info[0].toNumber(), info[1].toNumber()]
                        )
                    )
                ]
            )
        )

        const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(priKey.slice(2), 'hex'));

        await proxyIns.harvest(USDT_RINKEBY, mumbaiChainID, v, r, s);
    })

    ///relayer从proxy中取钱，意味着流程进入了最后一步，此时用户应该从目标链上提取完成并且event出来了rsv，relayer监控到rsv之后提交rsv到目标链进行取钱。
    /// rinkeby =》mumbai
    it("should harvestForRealyer success", async ()=>{
        let proxyIns = await Proxy.deployed();

        //构造用户的vrs，此时模仿的是在目标链上的数据
        let DOMAIN_SEPARATOR = utils.keccak256(
            utils.defaultAbiCoder.encode(
              ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
              [
                utils.keccak256(
                    utils.toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
                ),
                utils.keccak256(utils.toUtf8Bytes("Proxy")),
                utils.keccak256(utils.toUtf8Bytes('1')),
                rinkebyChainID,
                proxyIns.address
              ]
            )
        );
        let info = await proxyIns.getDepositInfoCurrent(admin, USDT_RINKEBY, mumbaiChainID);
        let PERMIT_TYPEHASH = await proxyIns.HARVEST_TYPEHASH();
        let digest = utils.keccak256(
            utils.solidityPack(
                ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
                [
                    '0x19',
                    '0x01',
                    DOMAIN_SEPARATOR,
                    utils.keccak256(
                        utils.defaultAbiCoder.encode(
                            ['bytes32', 'address', 'address', 'uint', 'uint'],
                            [PERMIT_TYPEHASH, USDT_RINKEBY, admin, info[0].toNumber(), info[2].toNumber()]
                        )
                    )
                ]
            )
        )
        //这里的vrs是用户调用目标链上的deposit方法时通知出来的
        const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(priKey.slice(2), 'hex'));
        //利用上面构造好的目标链上的rsv，去源链上取钱
        await proxyIns.harvestForRealyer(USDT_RINKEBY, admin, mumbaiChainID, v, r, s, {from: relayer});
    })
})