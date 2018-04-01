/* globals jest */
import Web3 from "web3";
import B0xJS from "../index";

// const networkUrl = "https://testnet.b0x.network";
const networkUrl = "http://localhost:8545";
const networkId = 50;
const provider = new Web3.providers.HttpProvider(networkUrl);
const b0xJS = new B0xJS(provider, { networkId });

// Testnet mines about every 5-10 sec
jest.setTimeout(100000);

export default b0xJS;
