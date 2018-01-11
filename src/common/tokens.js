export const TOKENS = {
  WETH: {
    label: `Ether Token`,
    address: `WETH_SM_ADDRESS_HERE`,
    iconUrl: `https://files.coinmarketcap.com/static/img/coins/128x128/ethereum.png`,
    decimals: 18
  },
  ZRX: {
    label: `0x Protocol Token`,
    address: `ZRX_SM_ADDRESS_HERE`,
    iconUrl: `https://files.coinmarketcap.com/static/img/coins/128x128/0x.png`,
    decimals: 18
  },
  MKR: {
    label: `MakerDAO`,
    address: `MKR_SM_ADDRESS_HERE`,
    iconUrl: `https://files.coinmarketcap.com/static/img/coins/128x128/maker.png`,
    decimals: 18
  }
};

export const getTokenInfo = address => {
  const tokenArray = Object.entries(TOKENS).map(([symbol, data]) => ({
    name: data.label,
    symbol,
    decimals: data.decimals,
    address: data.address
  }));
  return tokenArray.filter(token => token.address === address)[0];
};
