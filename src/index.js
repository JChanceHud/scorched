const { ethers } = require('ethers')
const ScorchedABI = require('./ScorchedABI.json')
const AdjudicatorABI = require('./AdjudicatorABI.json')
const ScorchedMarketABI = require('./ScorchedMarketABI.json')

const AppStatus = {
  Negotiate: 0,
  Answer: 1,
  Validate: 2,
}

const QueryStatus = {
  None: 0,
  Accepted: 1,
  Declined: 2,
}

const ResponseStatus = {
  None: 0,
  Pay: 1,
  Burn: 2,
}

function encodeAppData(data) {
  return ethers.utils.defaultAbiCoder.encode(
    [
      'tuple(uint256 payment, uint256 suggesterBurn, uint256 askerBurn, uint8 status, uint8 queryStatus, uint8 responseStatus)',
    ],
    [data]
  )
}

function decodeAppData(data) {
  return ethers.utils.defaultAbiCoder.decode(
    [
      'tuple(uint256 payment, uint256 suggesterBurn, uint256 askerBurn, uint8 status, uint8 queryStatus, uint8 responseStatus)',
    ],
    data
  )
}

// A helper to provide a keyed object instead of an array
function parseAppData(data) {
  const [[
    payment,
    suggesterBurn,
    askerBurn,
    status,
    queryStatus,
    responseStatus
  ]] = decodeAppData(data)
  return { payment, suggesterBurn, askerBurn, status, queryStatus, responseStatus }
}

function createOutcome(balances, assetHolderAddress) {
  const keyedBalances = {}
  for (const address of Object.keys(balances)) {
    keyedBalances[ethers.utils.hexZeroPad(address, 32)] = balances[address]
  }
  const allocation = []
  for (const key of Object.keys(keyedBalances)) {
    allocation.push({
      destination: key,
      amount: keyedBalances[key],
    })
  }
  return [
    {
      asset: ethers.constants.AddressZero,
      assetHolderAddress,
      allocationItems: allocation,
    }
  ]
}

module.exports = {
  ScorchedABI,
  AdjudicatorABI,
  ScorchedMarketABI,
  AppStatus,
  QueryStatus,
  ResponseStatus,
  encodeAppData,
  decodeAppData,
  createOutcome,
  parseAppData,
}
