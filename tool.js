const fs = require('fs');
const utils = require("ethers").utils;
const ecsign = require('ethereumjs-util').ecsign; 
const hdkey = require('ethereumjs-wallet').hdkey;
const bip39 = require("bip39");
const util = require('ethereumjs-util');
const mnemonic = fs.readFileSync(".secret").toString().trim();
const seedBuffer = bip39.mnemonicToSeedSync(mnemonic);
const key = hdkey.fromMasterSeed(seedBuffer).derivePath("m/44'/60'/0'/0/0");
const priKey = util.bufferToHex(key.getWallet().privateKey);

let PERMIT_TYPEHASH = "0x6d0ee39968261b1f87053b0d5ebf68b720a9891a612c6ef260a27d1e54f0e097";
var chainid = 4;
var proxyAddress = "0x2E2DCd2F571f3139b7DCEb4F2a3eFefb4352Cd6D";
let usdtAddress = "0x9C126aa4Eb6D110D646139969774F2c5b64dD279";
let amount = 11111;
let nonce = 1;
let user = "0x9C126aa4Eb6D110D646139969774F2c5b64dD279";


let DOMAIN_SEPARATOR = utils.keccak256(
    utils.defaultAbiCoder.encode(
      ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
      [
        utils.keccak256(
            utils.toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
        ),
        utils.keccak256(utils.toUtf8Bytes("Proxy")),
        utils.keccak256(utils.toUtf8Bytes('1')),
        chainid,
        proxyAddress
      ]
    )
);
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
                    [PERMIT_TYPEHASH, usdtAddress, user, amount, nonce]
                )
            )
        ]
    )
)
//这里的vrs是用户调用目标链上的deposit方法时通知出来的
const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(priKey.slice(2), 'hex'));

console.log(v);
console.log(utils.hexlify(r));
console.log(utils.hexlify(s));