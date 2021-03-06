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
        //???approve
        await tetherTokenIns.approve(proxyIns.address, amount + reward);
        let allowance = await tetherTokenIns.allowance(admin, proxyIns.address);
        //?????????deposit
        await proxyIns.deposit(tetherTokenIns.address, amount, reward, mumbaiChainID);
        let info = await proxyIns.getDepositInfoCurrent(admin, tetherTokenIns.address, mumbaiChainID);
        assert.equal(info[0].toNumber(), amount);
        assert.equal(info[1].toNumber(), reward);
    })

    ///ps:?????????????????????????????????withdraw????????????????????????
    // it("should withdraw success", async ()=>{
    //     let proxyIns = await Proxy.deployed();
    //     let tetherTokenIns = await TetherToken.at(USDT_RINKEBY);
    //     //withdraw??????usdt?????????
    //     let balanceOfOld = await tetherTokenIns.balanceOf(admin);
    //     await proxyIns.withdraw(USDT_RINKEBY, mumbaiChainID);
    //     //withdraw??????usdt?????????
    //     let balanceOfNew = await tetherTokenIns.balanceOf(admin);
    //     //??????proxy????????????info?????????0
    //     let info = await proxyIns.getDepositInfoCurrent(admin, tetherTokenIns.address, mumbaiChainID);

    //     assert.equal(balanceOfNew - balanceOfOld, amount + reward);
    //     assert.equal(info[0].toNumber(), 0);
    // })

    ///?????????????????????withdraw?????????????????????deposit??????
    it("should lock success", async ()=>{
        let proxyIns = await Proxy.deployed();
        // let tetherTokenIns = await TetherToken.at(USDT_RINKEBY);
        // //???approve
        // await tetherTokenIns.approve(proxyIns.address, amount + reward);
        // //?????????deposit
        // await proxyIns.deposit(tetherTokenIns.address, amount, reward, mumbaiChainID);
        //??????relayer???lock
        await proxyIns.lock(USDT_RINKEBY, admin, mumbaiChainID, {from: relayer});
        let info = await proxyIns.getDepositInfoCurrent(admin, USDT_RINKEBY, mumbaiChainID);
        assert.equal(info[5], relayer);
    })

    ///relayer?????????????????????????????????????????????
    ///mumbai =??? rinkeby
    it("should depositForRelayer success", async ()=>{
        let proxyIns = await Proxy.deployed();
        let tetherTokenIns = await TetherToken.at(USDT_RINKEBY);
        //???approve
        await tetherTokenIns.approve(proxyIns.address, amount, {from: relayer});
        
        await proxyIns.depositForRelayer(USDT_RINKEBY, admin, amount, 1, mumbaiChainID, rinkebyChainID, 1730404195, {from: relayer});
        let info = await proxyIns.getHarvestInfoCurrent(admin, USDT_RINKEBY, mumbaiChainID);
        assert.equal(info[0].toNumber(), amount);
    })

    /// ????????????relayer????????????????????????
    /// mumbai =??? rinkeby??? mumbai?????????????????????mumbai??????????????????????????????relayer??????????????????rinkeby????????????
    it("should harvest success", async ()=>{
        let proxyIns = await Proxy.deployed();

        //?????????mumbaiChainID???DomainSeparator
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

    ///relayer???proxy??????????????????????????????????????????????????????????????????????????????????????????????????????event?????????rsv???relayer?????????rsv????????????rsv???????????????????????????
    /// rinkeby =???mumbai
    it("should harvestForRealyer success", async ()=>{
        let proxyIns = await Proxy.deployed();

        //???????????????vrs?????????????????????????????????????????????
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
        //?????????vrs??????????????????????????????deposit????????????????????????
        const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(priKey.slice(2), 'hex'));
        //???????????????????????????????????????rsv?????????????????????
        await proxyIns.harvestForRealyer(USDT_RINKEBY, admin, mumbaiChainID, v, r, s, {from: relayer});
    })
})