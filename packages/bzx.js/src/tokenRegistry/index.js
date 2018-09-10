import * as utils from "../core/utils";
import { getContracts, tokenList } from "../contracts";
import * as Addresses from "../addresses";

export const getTokenList = async ({ web3, networkId }) => {
  
  let tokens = await tokenList(networkId);
  if (tokens)
    return tokens;

  // Fallback to on chain TokenRegistry if local list not found
  // Note: The local list is a stopgap to address MetaMask/Infura instability
  
  const tokenRegistryContract = await utils.getContractInstance(
    web3,
    getContracts(networkId).TokenRegistry.abi,
    Addresses.getAddresses(networkId).TokenRegistry
  );

  const tokenAddresses = await tokenRegistryContract.methods
    .getTokenAddresses()
    .call();

  const getTokenPs = tokenAddresses.map(async address => {
    const doesExist = await utils.doesContractExistAtAddress(web3, address);
    if (doesExist) {
      const tokenData = await tokenRegistryContract.methods
        .getTokenMetaData(address)
        .call();
      return {
        address: tokenData[0].toLowerCase(),
        name: tokenData[1],
        symbol: tokenData[2],
        decimals: tokenData[3],
        url: tokenData[4]
      };
    }
    return null;
  });

  const tokensRaw = await Promise.all(getTokenPs);
  tokens = tokensRaw.filter(token => !!token);

  return tokens;
};
