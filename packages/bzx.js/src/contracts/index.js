import { map } from "ramda";
import _local from "./local";
import _mainnet, { TokenList as mainnetTokens } from "./mainnet";
import _ropsten, { TokenList as ropstenTokens } from "./ropsten";
import _kovan from "./kovan";
import _rinkeby from "./rinkeby";

const toLowerCase = map(({ address, ...rest }) => ({
  address: address.toLowerCase(),
  ...rest
}));

const networksRaw = {
  local: _local,
  mainnet: _mainnet,
  ropsten: _ropsten,
  kovan: _kovan,
  rinkeby: _rinkeby
};
const networks = map(network => toLowerCase(network), networksRaw);

export const { local, mainnet, ropsten, kovan, rinkeby } = networks;

const networksById = {
  1: mainnet,
  3: ropsten,
  4: rinkeby,
  42: kovan
};

const tokensById = {
  1: mainnetTokens,
  3: ropstenTokens
};

export const getContracts = (networkId = null) =>
  networksById[networkId] ? networksById[networkId] : local;

export const tokenList = (networkId = null) =>
  tokensById[networkId] ? tokensById[networkId] : undefined;
