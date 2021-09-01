const Prxoy = artifacts.require("Proxy");

module.exports = async function(deployer, network, accounts){
    await deployer.deploy(Prxoy);
}